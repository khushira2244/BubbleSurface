"use client";

import { useEffect, useState } from "react";
import { createBrowserWebMcpAdapter } from "@/server/webmcp/browser-webmcp.adapter";
import type { BrowserToolRegistration } from "@/server/webmcp/webmcp-tool.types";

interface CapabilitySnapshot {
  context: { subjectId: string; lifecycleVersion: number };
  tools: Array<Omit<BrowserToolRegistration, "execute">>;
}

async function readJson(response: Response): Promise<unknown> {
  const body = await response.json();
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body
      && typeof body.error === "object" && body.error !== null && "message" in body.error
      ? String(body.error.message) : `WebMCP request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return body;
}

export function WebMcpBootstrap() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const adapter = createBrowserWebMcpAdapter();
    const requestController = new AbortController();
    const registeredNames: string[] = [];
    const available = adapter.isAvailable();
    setSupported(available);
    if (!available) return () => requestController.abort();

    void (async () => {
      try {
        const response = await fetch("/api/webmcp/capabilities/INC-1001", {
          cache: "no-store",
          signal: requestController.signal,
        });
        const snapshot = await readJson(response) as CapabilitySnapshot;
        for (const tool of snapshot.tools) {
          const didRegister = await adapter.register({
            ...tool,
            execute: async (rawInput, options) => {
              const input = typeof rawInput === "object" && rawInput !== null ? rawInput : {};
              const invocation = await fetch(`/api/webmcp/invoke/${encodeURIComponent(tool.name)}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  ...input,
                  subjectId: snapshot.context.subjectId,
                  expectedLifecycleVersion: snapshot.context.lifecycleVersion,
                }),
                signal: options?.signal,
              });
              return readJson(invocation);
            },
          });
          if (didRegister) {
            registeredNames.push(tool.name);
            setRegisteredCount(registeredNames.length);
          }
        }
      } catch (cause) {
        if (!requestController.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "WebMCP bootstrap failed.");
        }
      }
    })();

    return () => {
      requestController.abort();
      for (const toolName of registeredNames) void adapter.unregister(toolName);
    };
  }, []);

  return <div>
    <div>WebMCP: {supported === null ? "checking" : supported ? "supported" : "unsupported"}</div>
    <div>Registered tools: {registeredCount}</div>
    {error ? <div>WebMCP error: {error}</div> : null}
  </div>;
}

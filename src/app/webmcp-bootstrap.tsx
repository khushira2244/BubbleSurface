"use client";

import { useEffect, useState } from "react";
import { BubbleSurfaceWeb, HttpCapabilitySnapshotTransport } from "@/server/webmcp/bubble-surface-web";

export function WebMcpBootstrap() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let integration: BubbleSurfaceWeb | null = null;
    let cancelled = false;
    void BubbleSurfaceWeb.init({
      subject: { type: "INCIDENT", id: "INC-1001", category: "IDENTITY_SESSION_COMPROMISE" },
      transport: new HttpCapabilitySnapshotTransport(), refreshIntervalMs: 2_000,
      onChange: (state) => { if (!cancelled) { setSupported(state.available); setRegisteredCount(state.registered.length); setError(null); } },
      onError: (cause) => { if (!cancelled) { if (cause.code === "WEBMCP_UNAVAILABLE") setSupported(false); else setError(cause.message); } },
    }).then((value) => { if (cancelled) void value.dispose(); else integration = value; })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "WebMCP bootstrap failed."); });
    return () => { cancelled = true; if (integration) void integration.dispose(); };
  }, []);

  return <div>
    <div>WebMCP: {supported === null ? "checking" : supported ? "supported" : "unsupported"}</div>
    <div>Registered tools: {registeredCount}</div>
    {error ? <div>WebMCP error: {error}</div> : null}
  </div>;
}

"use client";

import type { BrowserWebMcpAdapter } from "./browser-webmcp.adapter";
import { createBrowserWebMcpAdapter } from "./browser-webmcp.adapter";
import type { CapabilitySnapshotTransport, CapabilitySubject } from "./integration-contracts";
import type { RegistryDelta } from "./registry-reconciler";
import type { BrowserToolRegistration } from "./webmcp-tool.types";
import { BrowserCapabilityReconciler } from "./browser-capability-reconciler";

export class BubbleSurfaceWebError extends Error {
  constructor(readonly code: "WEBMCP_UNAVAILABLE" | "CAPABILITY_REFRESH_FAILED" | "TOOL_REGISTRATION_FAILED" | "INVOCATION_FAILED",
    message: string, readonly cause?: unknown, readonly capabilityId?: string) { super(message); }
}

export interface BubbleSurfaceWebOptions {
  subject: CapabilitySubject;
  transport: CapabilitySnapshotTransport;
  adapter?: BrowserWebMcpAdapter;
  refreshIntervalMs?: number;
  onChange?: (state: BubbleSurfaceWebState) => void;
  onError?: (error: BubbleSurfaceWebError) => void;
}
export interface BubbleSurfaceWebState {
  available: boolean; registered: string[]; delta: RegistryDelta;
  authoritativeVersion: number | null;
}

/** Reusable browser controller for feature detection, reconciliation, invocation routing and cleanup. */
export class BubbleSurfaceWeb {
  private readonly adapter: BrowserWebMcpAdapter;
  private readonly reconciler: BrowserCapabilityReconciler;
  private disposed = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshPromise: Promise<BubbleSurfaceWebState> | null = null;
  private activeRefresh: AbortController | null = null;
  private currentContext: { subjectId: string; lifecycleVersion: number } | null = null;
  private subject: CapabilitySubject;

  private constructor(private readonly options: BubbleSurfaceWebOptions) {
    this.adapter = options.adapter ?? createBrowserWebMcpAdapter();
    this.reconciler = new BrowserCapabilityReconciler(this.adapter);
    this.subject = options.subject;
  }

  static async init(options: BubbleSurfaceWebOptions): Promise<BubbleSurfaceWeb> {
    const instance = new BubbleSurfaceWeb(options);
    if (!instance.adapter.isAvailable()) {
      const error = new BubbleSurfaceWebError("WEBMCP_UNAVAILABLE", "This browser does not expose the WebMCP model context API.");
      options.onError?.(error); options.onChange?.({ available: false, registered: [],
        delta: { added: [], retained: [], removed: [] }, authoritativeVersion: null });
      return instance;
    }
    await instance.refresh();
    if (options.refreshIntervalMs && options.refreshIntervalMs > 0) {
      instance.refreshTimer = setInterval(() => { void instance.refresh().catch(() => undefined); }, options.refreshIntervalMs);
    }
    return instance;
  }

  refresh(): Promise<BubbleSurfaceWebState> {
    if (this.disposed) return Promise.reject(new BubbleSurfaceWebError("CAPABILITY_REFRESH_FAILED", "BubbleSurfaceWeb is disposed."));
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<BubbleSurfaceWebState> {
    try {
      const controller = new AbortController(); this.activeRefresh = controller;
      const snapshot = await this.options.transport.getCapabilities(this.subject, controller.signal);
      this.currentContext = snapshot.context;
      const registrations: BrowserToolRegistration[] = snapshot.tools.map((tool) => ({ ...tool, execute: async (rawInput, invokeOptions) => {
          try {
            const input = typeof rawInput === "object" && rawInput !== null ? rawInput as Record<string, unknown> : {};
            const context = this.currentContext;
            if (!context) throw new Error("No authoritative capability context is available.");
            return await this.options.transport.invoke(tool.name, { ...input, subjectId: context.subjectId,
              expectedLifecycleVersion: context.lifecycleVersion }, invokeOptions?.signal);
          } catch (cause) {
            throw new BubbleSurfaceWebError("INVOCATION_FAILED", `Capability ${tool.name} invocation failed.`, cause, tool.name);
          } finally {
            if (!this.disposed) void this.refresh().catch(() => undefined);
          }
        } }));
      let reconciled;
      try { reconciled = await this.reconciler.reconcile(registrations); }
      catch (cause) { throw new BubbleSurfaceWebError("TOOL_REGISTRATION_FAILED", "A capability could not be reconciled.", cause); }
      const state = { available: true, registered: reconciled.registered, delta: reconciled.delta,
        authoritativeVersion: snapshot.context.lifecycleVersion };
      this.options.onChange?.(state); return state;
    } catch (cause) {
      const error = cause instanceof BubbleSurfaceWebError ? cause
        : new BubbleSurfaceWebError("CAPABILITY_REFRESH_FAILED", "Capability refresh failed.", cause);
      this.options.onError?.(error); throw error;
    } finally {
      this.activeRefresh = null;
    }
  }

  async setSubject(subject: CapabilitySubject): Promise<BubbleSurfaceWebState> {
    if (this.disposed) throw new BubbleSurfaceWebError("CAPABILITY_REFRESH_FAILED", "BubbleSurfaceWeb is disposed.");
    this.activeRefresh?.abort();
    if (this.refreshPromise) { try { await this.refreshPromise; } catch { /* Superseded refresh. */ } }
    this.subject = subject; this.currentContext = null;
    return this.refresh();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.activeRefresh?.abort();
    await this.reconciler.dispose();
  }
}

export class HttpCapabilitySnapshotTransport implements CapabilitySnapshotTransport {
  constructor(private readonly baseUrl = "") {}
  private async json(response: Response) {
    const body = await response.json();
    if (!response.ok) throw Object.assign(new Error(`BubbleSurface HTTP ${response.status}.`), { response: body });
    return body;
  }
  async getCapabilities(subject: CapabilitySubject, signal?: AbortSignal) {
    return this.json(await fetch(`${this.baseUrl}/api/webmcp/capabilities/${encodeURIComponent(subject.id)}`,
      { cache: "no-store", signal }));
  }
  async invoke(capabilityId: string, input: unknown, signal?: AbortSignal) {
    return this.json(await fetch(`${this.baseUrl}/api/webmcp/invoke/${encodeURIComponent(capabilityId)}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal,
    }));
  }
}

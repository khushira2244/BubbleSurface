import type { BrowserWebMcpAdapter } from "./browser-webmcp.adapter";
import { reconcileToolNames } from "./registry-reconciler";
import type { BrowserToolRegistration } from "./webmcp-tool.types";

/** Shared reconciliation engine used by both server-composed and HTTP-backed browser integrations. */
export class BrowserCapabilityReconciler {
  private readonly registered = new Set<string>();
  constructor(private readonly browser: BrowserWebMcpAdapter) {}

  async reconcile(desiredTools: Iterable<BrowserToolRegistration>) {
    const desired = new Map([...desiredTools].map((tool) => [tool.name, tool]));
    const delta = reconcileToolNames(this.registered, desired.keys());
    const appliedRemoved: string[] = [], appliedAdded: string[] = [];
    for (const name of delta.removed) {
      if (await this.browser.unregister(name)) { this.registered.delete(name); appliedRemoved.push(name); }
    }
    for (const name of delta.added) {
      if (await this.browser.register(desired.get(name)!)) { this.registered.add(name); appliedAdded.push(name); }
    }
    return { delta, appliedAdded, appliedRemoved, registered: this.names() };
  }

  async dispose() {
    const removed: string[] = [];
    for (const name of this.names()) if (await this.browser.unregister(name)) removed.push(name);
    this.registered.clear();
    return removed;
  }
  names() { return [...this.registered].sort(); }
}

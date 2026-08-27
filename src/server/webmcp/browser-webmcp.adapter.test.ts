import { describe, expect, it, vi } from "vitest";
import { ExperimentalBrowserWebMcpAdapter } from "./browser-webmcp.adapter";

describe("ExperimentalBrowserWebMcpAdapter", () => {
  it("does not crash when WebMCP is unavailable", async () => {
    const adapter = new ExperimentalBrowserWebMcpAdapter(undefined);
    expect(adapter.isAvailable()).toBe(false);
    await expect(adapter.register({ name: "inspect_incident", description: "read", inputSchema: {}, execute: () => ({}) })).resolves.toBe(false);
    await expect(adapter.unregister("inspect_incident")).resolves.toBe(false);
  });
  it("awaits registration and removes the tool by aborting its dedicated signal", async () => {
    let registrationSignal: AbortSignal | undefined;
    const registerTool = vi.fn(async (_tool: unknown, options: { signal: AbortSignal }) => { registrationSignal = options.signal; });
    const adapter = new ExperimentalBrowserWebMcpAdapter({ modelContext: { registerTool } });
    await expect(adapter.register({ name: "inspect_incident", description: "read", inputSchema: {}, execute: () => ({}) })).resolves.toBe(true);
    expect(registerTool).toHaveBeenCalledOnce(); expect(registrationSignal?.aborted).toBe(false);
    await expect(adapter.unregister("inspect_incident")).resolves.toBe(true);
    expect(registrationSignal?.aborted).toBe(true);
  });
});

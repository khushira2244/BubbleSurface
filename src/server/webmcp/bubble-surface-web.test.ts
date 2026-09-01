import { describe, expect, it, vi } from "vitest";
import type { BrowserWebMcpAdapter } from "./browser-webmcp.adapter";
import { BubbleSurfaceWeb } from "./bubble-surface-web";
import type { CapabilitySnapshotTransport } from "./integration-contracts";
import type { BrowserToolRegistration } from "./webmcp-tool.types";

class MemoryAdapter implements BrowserWebMcpAdapter {
  readonly tools = new Map<string, BrowserToolRegistration>();
  isAvailable() { return true; }
  async register(tool: BrowserToolRegistration) { this.tools.set(tool.name, tool); return true; }
  async unregister(name: string) { return this.tools.delete(name); }
}
const tool = (name: string) => ({ name, description: name, inputSchema: { type: "object" } });

describe("BubbleSurfaceWeb browser integration", () => {
  it("dynamically reconciles approval and execution capability changes and disposes registrations", async () => {
    const stages = [
      [tool("inspect_incident")],
      [tool("inspect_incident"), tool("revoke_approved_sessions")],
      [tool("inspect_incident"), tool("verify_containment"), tool("verify_identity_state")],
    ];
    let stage = 0;
    const transport: CapabilitySnapshotTransport = {
      getCapabilities: vi.fn(async () => ({ context: { subjectId: "subject-1", lifecycleVersion: stage + 1 }, tools: stages[stage] })),
      invoke: vi.fn(async () => ({ ok: true })),
    };
    const adapter = new MemoryAdapter();
    const integration = await BubbleSurfaceWeb.init({ subject: { type: "INCIDENT", id: "subject-1" }, transport, adapter });
    expect([...adapter.tools]).toHaveLength(1);
    stage = 1;
    expect((await integration.refresh()).delta.added).toEqual(["revoke_approved_sessions"]);
    expect(adapter.tools.has("revoke_approved_sessions")).toBe(true);
    stage = 2;
    const afterExecution = await integration.refresh();
    expect(afterExecution.delta.removed).toEqual(["revoke_approved_sessions"]);
    expect(afterExecution.delta.added).toEqual(["verify_containment", "verify_identity_state"]);
    await integration.dispose();
    expect(adapter.tools.size).toBe(0);
  });

  it("refreshes after routed invocation instead of retaining a one-time snapshot", async () => {
    const adapter = new MemoryAdapter();
    let calls = 0;
    const transport: CapabilitySnapshotTransport = {
      getCapabilities: vi.fn(async () => ({ context: { subjectId: "subject-1", lifecycleVersion: calls + 1 },
        tools: calls === 0 ? [tool("custom_action")] : [tool("verify_custom_action")] })),
      invoke: vi.fn(async () => { calls += 1; return { ok: true }; }),
    };
    const integration = await BubbleSurfaceWeb.init({ subject: { type: "INCIDENT", id: "subject-1" }, transport, adapter });
    await adapter.tools.get("custom_action")!.execute({});
    await vi.waitFor(() => expect(adapter.tools.has("verify_custom_action")).toBe(true));
    expect(adapter.tools.has("custom_action")).toBe(false);
    expect(transport.getCapabilities).toHaveBeenCalledTimes(2);
    await integration.dispose();
  });

  it("switches subjects by removing old tools and registering only the new subject capabilities", async () => {
    const adapter = new MemoryAdapter();
    const transport: CapabilitySnapshotTransport = {
      getCapabilities: vi.fn(async (subject) => ({ context: { subjectId: subject.id, lifecycleVersion: 1 },
        tools: subject.id === "old" ? [tool("old_subject_tool")] : [tool("new_subject_tool")] })),
      invoke: vi.fn(),
    };
    const integration = await BubbleSurfaceWeb.init({ subject: { type: "INCIDENT", id: "old" }, transport, adapter });
    const changed = await integration.setSubject({ type: "ALERT", id: "new" });
    expect(changed.delta).toEqual({ added: ["new_subject_tool"], retained: [], removed: ["old_subject_tool"] });
    expect([...adapter.tools.keys()]).toEqual(["new_subject_tool"]);
    await integration.dispose();
  });
});

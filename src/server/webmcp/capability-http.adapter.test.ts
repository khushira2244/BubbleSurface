import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CapabilityEnforcementService } from "./capability-enforcement.service";
import { CapabilityHttpAdapter } from "./capability-http.adapter";
import { CapabilityRegistry } from "./capability-registry";
import { DemoPrincipalResolver } from "./demo-principal-resolver";
import type { AuthoritativeState, ResolvedPrincipal } from "./integration-contracts";

const descriptor = () => ({ name: "search_alerts", description: "Search application alerts", classification: "READ" as const,
  inputSchema: z.object({ query: z.string(), actorId: z.string().optional() }),
  outputSchema: z.object({ principalId: z.string(), query: z.string() }),
  execute: (input: unknown, context: { actorId: string }) => ({ principalId: context.actorId,
    query: (input as { query: string }).query }) });

function setup(principal: ResolvedPrincipal) {
  const registry = new CapabilityRegistry().register(descriptor());
  const load = vi.fn(async (subject, trusted: ResolvedPrincipal): Promise<AuthoritativeState> => ({
    subject, version: 9, state: "OPEN", actor: trusted,
  }));
  const enforcement = new CapabilityEnforcementService(registry, { load }, { evaluate: (state) => ({
    allowed: state.actor.permissions.includes("INVESTIGATE"), reasonCode: "INVESTIGATE_REQUIRED", reason: "Investigate permission required.",
  }) });
  return { adapter: new CapabilityHttpAdapter(enforcement, new DemoPrincipalResolver(principal)), load };
}

describe("generic capability HTTP adapter", () => {
  it("ignores browser-supplied actor IDs and cannot elevate an unprivileged resolved principal", async () => {
    const { adapter } = setup({ id: "guest", type: "HUMAN", permissions: [] });
    const response = await adapter.invoke({ headers: { authorization: "untrusted" } }, { capabilityId: "search_alerts",
      subject: { type: "ALERT", id: "A-1" }, expectedVersion: 9,
      arguments: { query: "critical", actorId: "admin" } });
    expect(response).toMatchObject({ status: 403, body: { error: { code: "CAPABILITY_DENIED" } } });
  });

  it("uses a server-resolved demo principal for provider-free discovery and authoritative invocation", async () => {
    const { adapter, load } = setup({ id: "demo-analyst", type: "HUMAN", permissions: ["INVESTIGATE"] });
    const discovered = await adapter.discover({}, { type: "ALERT", id: "A-2" });
    expect(discovered).toMatchObject({ status: 200, body: { context: { subjectId: "A-2", lifecycleVersion: 9 },
      tools: [{ name: "search_alerts", annotations: { readOnlyHint: true } }] } });
    const invoked = await adapter.invoke({}, { capabilityId: "search_alerts", subject: { type: "ALERT", id: "A-2" },
      expectedVersion: 9, arguments: { query: "phish", actorId: "forged-admin" } });
    expect(invoked).toEqual({ status: 200, body: { data: { principalId: "demo-analyst", query: "phish" } } });
    expect(load).toHaveBeenCalledWith({ type: "ALERT", id: "A-2" }, expect.objectContaining({ id: "demo-analyst" }));
  });

  it("returns structured validation, unknown-capability, and authoritative-version errors", async () => {
    const { adapter } = setup({ id: "demo-analyst", type: "HUMAN", permissions: ["INVESTIGATE"] });
    expect((await adapter.invoke({}, { capabilityId: "missing", subject: { type: "ALERT", id: "A" },
      expectedVersion: 9, arguments: {} })).status).toBe(404);
    expect((await adapter.invoke({}, { capabilityId: "search_alerts", subject: { type: "ALERT", id: "A" },
      expectedVersion: 9, arguments: { query: 4 } })).status).toBe(400);
    expect((await adapter.invoke({}, { capabilityId: "search_alerts", subject: { type: "ALERT", id: "A" },
      expectedVersion: 8, arguments: { query: "x" } })).status).toBe(409);
  });
});

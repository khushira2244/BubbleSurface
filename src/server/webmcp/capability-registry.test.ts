import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CapabilityRegistry } from "./capability-registry";
import { CapabilityEnforcementService } from "./capability-enforcement.service";
import type { AuthoritativeState } from "./integration-contracts";

describe("reusable capability integration", () => {
  it("registers and invokes an application capability without demo providers", async () => {
    const registry = new CapabilityRegistry().register({
      name: "search_security_alerts", description: "Search the application's own alerts.", classification: "READ",
      applicability: { subjectTypes: ["ALERT"] }, policyRequirements: { permissions: ["INVESTIGATE"], authoritativeVersion: true },
      inputSchema: z.object({ query: z.string() }), outputSchema: z.object({ matches: z.number() }),
      execute: ({ query }) => ({ matches: String(query).length }),
    });
    const state: AuthoritativeState = { subject: { type: "ALERT", id: "alert-7" }, version: 4,
      state: "OPEN", actor: { id: "analyst-7", type: "HUMAN", permissions: ["INVESTIGATE"] } };
    const service = new CapabilityEnforcementService(registry, { load: async () => state }, {
      evaluate: (current, descriptor) => ({ allowed: current.actor.permissions.includes(descriptor.policyRequirements?.permissions?.[0] ?? ""),
        reasonCode: "APPLICATION_POLICY", reason: "Application supplied policy." }),
    });
    const result = await service.invoke({ capabilityId: "search_security_alerts", subject: state.subject,
      principal: state.actor, expectedVersion: 4, arguments: { query: "phish" } });
    expect(result).toEqual({ matches: 5 });
    expect(registry.list()[0]).toMatchObject({ name: "search_security_alerts", applicability: { subjectTypes: ["ALERT"] } });
  });
});

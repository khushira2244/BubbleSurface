import { describe, expect, it } from "vitest";
import { evaluateCapabilities } from "./capability-policy";
import { approvedExecutionScenario, investigatingScenario as context } from "./test-support/scenario-context";
import type { CapabilityContext } from "./capability.types";
const names = (ctx: CapabilityContext) => evaluateCapabilities(ctx).allowed.map((item) => item.toolName);

describe("evaluateCapabilities", () => {
  it("exposes only READ tools while investigating", () => {
    expect(names(context())).toEqual(["inspect_incident", "get_active_sessions", "get_device_context", "check_privilege_changes", "review_evidence_timeline"]);
  });
  it("adds prepare_containment when validated", () => {
    expect(names(context({ lifecycleState: "VALIDATED" }))).toContain("prepare_containment");
  });
  it("keeps execution tools locked before exact approval", () => {
    const evaluation = evaluateCapabilities(context({ lifecycleState: "CONTAINING", proposalActionId: "ACT-1",
      proposalActionType: "REVOKE_SESSIONS", proposalVersion: 1, proposalState: "PROPOSED",
      proposalAuthorities: [{ actionId: "ACT-1", actionType: "REVOKE_SESSIONS", proposalVersion: 1,
        proposalState: "PROPOSED", approvalState: "NONE", executionState: "NONE" }] }));
    expect(evaluation.locked.find((x) => x.toolName === "revoke_approved_sessions")?.reasonCode).toBe("EXACT_APPROVAL_REQUIRED");
  });
  it("does not expose execution tools while awaiting approval", () => {
    expect(names(context({ lifecycleState: "AWAITING_APPROVAL" }))).not.toEqual(expect.arrayContaining(["revoke_approved_sessions", "remove_approved_privilege"]));
  });
  it("exposes only the execution tool authorized by the approved action type", () => {
    const allowed = names(context({ lifecycleState: "CONTAINING", proposalActionId: "ACT-1",
      proposalActionType: "REVOKE_SESSIONS", proposalVersion: 1, proposalState: "PROPOSED", approvalState: "APPROVED",
      proposalAuthorities: [{ actionId: "ACT-1", actionType: "REVOKE_SESSIONS", proposalVersion: 1,
        proposalState: "PROPOSED", approvalState: "APPROVED", executionState: "NONE" }] }));
    expect(allowed).toContain("revoke_approved_sessions");
    expect(allowed).not.toContain("remove_approved_privilege");
  });
  it("exposes only privilege removal for an approved privilege proposal", () => {
    const allowed = names(approvedExecutionScenario("REMOVE_PRIVILEGE"));
    expect(allowed).toContain("remove_approved_privilege");
    expect(allowed).not.toContain("revoke_approved_sessions");
  });
  it("keeps execution locked when execute permission is missing", () => {
    const allowed = names(approvedExecutionScenario("REVOKE_SESSIONS", ["INVESTIGATE", "PREPARE", "APPROVE", "VERIFY"]));
    expect(allowed).not.toContain("revoke_approved_sessions");
  });
  it("removes execution after the approved action succeeds", () => {
    const succeeded = approvedExecutionScenario("REVOKE_SESSIONS");
    succeeded.proposalAuthorities[0].executionState = "SUCCEEDED";
    expect(names(succeeded)).not.toContain("revoke_approved_sessions");
  });
  it.each(["RECOVERED", "CLOSED"] as const)("does not expose execution tools when %s", (lifecycleState) => {
    expect(names(context({ lifecycleState }))).not.toEqual(expect.arrayContaining(["revoke_approved_sessions", "remove_approved_privilege"]));
  });
  it("removes execution and exposes verification tools while verifying", () => {
    const allowed = names(context({ lifecycleState: "VERIFYING", proposalActionId: "ACT-1",
      proposalActionType: "REVOKE_SESSIONS", proposalVersion: 1, approvalState: "APPROVED" }));
    expect(allowed).not.toContain("revoke_approved_sessions");
    expect(allowed).toEqual(expect.arrayContaining(["verify_containment", "verify_identity_state"]));
  });
});

import type { CapabilityContext } from "../capability.types";

export const investigatingScenario = (overrides: Partial<CapabilityContext> = {}): CapabilityContext => ({
  subjectType: "INCIDENT", subjectId: "INC-1001", lifecycleState: "INVESTIGATING", lifecycleVersion: 3,
  incidentOrFindingType: "IDENTITY_SESSION_COMPROMISE", evidenceState: "SUFFICIENT",
  analystPermissions: ["INVESTIGATE", "PREPARE", "APPROVE", "EXECUTE", "VERIFY"],
  proposalState: "NONE", proposalActionId: null, proposalActionType: null, proposalVersion: null,
  approvalState: "NONE", executionState: "NONE", verificationState: "NONE", targetRiskLevel: "CRITICAL",
  proposalAuthorities: [], ...overrides,
});

export const approvedExecutionScenario = (actionType: "REVOKE_SESSIONS" | "REMOVE_PRIVILEGE",
  permissions: CapabilityContext["analystPermissions"] = ["INVESTIGATE", "PREPARE", "APPROVE", "EXECUTE", "VERIFY"]): CapabilityContext =>
  investigatingScenario({ lifecycleState: "CONTAINING", lifecycleVersion: 5, analystPermissions: permissions,
    proposalState: "PROPOSED", proposalActionId: "ACT-SCENARIO", proposalActionType: actionType,
    proposalVersion: 1, approvalState: "APPROVED",
    proposalAuthorities: [{ actionId: "ACT-SCENARIO", actionType, proposalVersion: 1,
      proposalState: "PROPOSED", approvalState: "APPROVED", executionState: "NONE" }] });

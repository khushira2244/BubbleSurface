import type { HumanSurfaceModel } from "../bubblesurface";
import type { IncidentContext } from "../../server/domain/security/security.schemas";
import type { CaseState } from "../../server/domain/lifecycle/lifecycle.types";

export interface LiveWorkspaceModel {
  incident: IncidentContext["incident"];
  lifecycle: IncidentContext["lifecycle"];
  identity: NonNullable<IncidentContext["identity"]>;
  sessions: IncidentContext["sessions"];
  privileges: IncidentContext["privileges"];
  events: IncidentContext["events"];
  capabilities: Array<{ toolName: string; classification: string }>;
  humanSurface: HumanSurfaceModel;
}

export function buildLiveWorkspaceModel(context: IncidentContext,
  capabilities: LiveWorkspaceModel["capabilities"]): LiveWorkspaceModel {
  if (!context.identity) throw new Error(`Incident ${context.incident.id} has no affected identity.`);
  const humanSurface: HumanSurfaceModel = {
    subject: { id: context.incident.id, type: "INCIDENT", label: context.identity.displayName, title: "Human intervention" },
    status: "IDLE",
    execution: { state: "NONE" },
    verification: { state: "NONE", checks: [] },
    activity: [],
    updatedAt: context.lifecycle.updatedAt,
  };
  return { incident: context.incident, lifecycle: context.lifecycle, identity: context.identity,
    sessions: context.sessions, privileges: context.privileges, events: context.events, capabilities, humanSurface };
}

export const workflowStages = ["Investigate", "Review", "Execute", "Verify", "Recovered"] as const;
export type WorkflowStage = typeof workflowStages[number];
export type WorkflowStageState = "COMPLETED" | "CURRENT" | "FUTURE";

const currentStageByLifecycle: Record<CaseState, WorkflowStage> = {
  NEW: "Investigate", TRIAGE: "Investigate", INVESTIGATING: "Investigate",
  VALIDATED: "Review", RESPONSE_PREPARED: "Review", AWAITING_APPROVAL: "Review",
  CONTAINING: "Execute", CONTAINED: "Verify", VERIFYING: "Verify",
  RECOVERED: "Recovered", CLOSED: "Recovered",
};

export interface LiveWorkspacePresentation {
  currentStage: WorkflowStage;
  stages: Array<{ label: WorkflowStage; state: WorkflowStageState }>;
  recovered: boolean;
  privilegeRemoved: boolean;
  showOutcome: boolean;
  outcome: {
    privilegeRemoval: "COMPLETED" | "FAILED" | "PENDING";
    identityVerification: "PASSED" | "FAILED" | "PENDING";
    containmentVerification: "PASSED" | "FAILED" | "PENDING";
    trustedSessionPreserved: boolean;
    incidentRecovered: boolean;
  };
}

export function deriveLiveWorkspacePresentation(
  lifecycleState: CaseState,
  privilegeStatus: string | undefined,
  human: Pick<HumanSurfaceModel, "execution" | "verification">,
): LiveWorkspacePresentation {
  const currentStage = currentStageByLifecycle[lifecycleState];
  const currentIndex = workflowStages.indexOf(currentStage);
  const check = (name: string) => human.verification.checks.find((item) => item.name === name);
  const identity = check("VERIFY_IDENTITY_STATE");
  const containment = check("VERIFY_CONTAINMENT");
  const recovered = lifecycleState === "RECOVERED" || lifecycleState === "CLOSED";
  const bothPassed = identity?.passed === true && containment?.passed === true;
  const executionSucceeded = human.execution.state === "SUCCEEDED";
  const executionFailed = human.execution.state === "FAILED" || human.execution.state === "UNKNOWN";
  return {
    currentStage,
    stages: workflowStages.map((label, index) => ({
      label,
      state: recovered || index < currentIndex ? "COMPLETED" : index === currentIndex ? "CURRENT" : "FUTURE",
    })),
    recovered,
    privilegeRemoved: privilegeStatus === "REVOKED",
    showOutcome: executionSucceeded || executionFailed || human.verification.checks.length > 0 || ["CONTAINED", "VERIFYING", "RECOVERED", "CLOSED"].includes(lifecycleState),
    outcome: {
      privilegeRemoval: executionSucceeded ? "COMPLETED" : executionFailed ? "FAILED" : "PENDING",
      identityVerification: identity ? (identity.passed ? "PASSED" : "FAILED") : "PENDING",
      containmentVerification: containment ? (containment.passed ? "PASSED" : "FAILED") : "PENDING",
      trustedSessionPreserved: identity?.passed === true,
      incidentRecovered: recovered && bothPassed,
    },
  };
}

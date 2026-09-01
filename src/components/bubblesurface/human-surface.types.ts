export type HumanSurfaceStatus = "IDLE" | "AGENT_ACTIVE" | "HUMAN_REVIEW_REQUIRED" | "APPROVED" | "REJECTED"
  | "SUPERSEDED" | "EXECUTING" | "EXECUTION_SUCCEEDED" | "EXECUTION_FAILED" | "VERIFYING" | "VERIFIED"
  | "VERIFICATION_FAILED" | "STALE";
export type ActivityActorType = "AGENT" | "HUMAN" | "SYSTEM";

export interface HumanSurfaceSubject { id: string; type: string; label: string; title?: string }
export interface HumanSurfaceProposal {
  actionId: string; actionType: string; actionDescription: string; rationale: string;
  version: number; lifecycleVersion: number; proposalState: "PROPOSED" | "SUPERSEDED" | "WITHDRAWN";
  approvalState: "NONE" | "APPROVED" | "REJECTED" | "MODIFIED";
  parameters: Record<string, unknown>; metadata: Record<string, unknown>;
  reviewable: boolean; staleReason?: string;
}
export interface HumanSurfaceExecution {
  state: "NONE" | "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  startedAt?: string | null; completedAt?: string | null; message?: string;
}
export interface HumanSurfaceVerification {
  state: "NONE" | "PENDING" | "VERIFYING" | "PASSED" | "FAILED";
  checks: Array<{ name: string; passed: boolean; checkedAt?: string }>;
  message?: string;
}
export interface HumanSurfaceActivity {
  id: string; actorType: ActivityActorType; label: string; detail?: string; occurredAt: string;
}
export interface HumanSurfaceModel {
  subject: HumanSurfaceSubject; status: HumanSurfaceStatus; proposal?: HumanSurfaceProposal;
  execution: HumanSurfaceExecution; verification: HumanSurfaceVerification;
  activity: HumanSurfaceActivity[]; updatedAt: string;
}

import type { ActionProposal, ApprovalDecision, AuditEvent, ExecutionRecord, ReasoningRun, VerificationResult } from "./control-plane.schemas";

export interface ControlPlaneRepository {
  saveActionProposal(proposal: ActionProposal): void;
  getActionProposal(actionId: string, proposalVersion: number): ActionProposal | null;
  saveApprovalDecision(decision: ApprovalDecision): void;
  saveExecutionRecord(record: ExecutionRecord): ExecutionRecord;
  getExecutionRecordByIdempotencyKey(idempotencyKey: string): ExecutionRecord | null;
  saveVerificationResult(result: VerificationResult): void;
  saveReasoningRun(run: ReasoningRun): void;
  getReasoningRun(id: string): ReasoningRun | null;
  appendAuditEvent(event: AuditEvent): void;
}

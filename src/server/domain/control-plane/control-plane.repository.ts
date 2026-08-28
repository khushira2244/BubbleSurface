import type { ActionProposal, ApprovalDecision, AuditEvent, ExecutionRecord, ReasoningRun, VerificationResult } from "./control-plane.schemas";

export interface ControlPlaneRepository {
  saveActionProposal(proposal: ActionProposal): void;
  getActionProposal(actionId: string, proposalVersion: number): ActionProposal | null;
  saveApprovalDecision(decision: ApprovalDecision): void;
  saveExecutionRecord(record: ExecutionRecord): ExecutionRecord;
  updateExecutionRecord(record: ExecutionRecord): ExecutionRecord;
  listExecutionRecords(actionId: string): ExecutionRecord[];
  getExecutionRecord(id: string): ExecutionRecord | null;
  getExecutionRecordByIdempotencyKey(idempotencyKey: string): ExecutionRecord | null;
  saveVerificationResult(result: VerificationResult): void;
  listVerificationResults(actionId: string): VerificationResult[];
  getVerificationResult(id: string): VerificationResult | null;
  getVerificationByIdempotencyKey(key: string): VerificationResult | null;
  saveReasoningRun(run: ReasoningRun): void;
  getReasoningRun(id: string): ReasoningRun | null;
  appendAuditEvent(event: AuditEvent): void;
}

import { actionProposalSchema, approvalDecisionSchema, auditEventSchema, executionRecordSchema, reasoningRunSchema, verificationResultSchema,
  type ActionProposal, type ApprovalDecision, type AuditEvent, type ExecutionRecord, type ReasoningRun, type VerificationResult } from "./control-plane.schemas";
import type { ControlPlaneRepository } from "./control-plane.repository";
import { EvidenceReferenceValidator } from "./evidence-reference.validator";

export class ControlPlaneService {
  constructor(private readonly repository: ControlPlaneRepository, private readonly evidence: EvidenceReferenceValidator) {}
  saveActionProposal(input: ActionProposal): void {
    const proposal = actionProposalSchema.parse(input);
    this.evidence.validate(proposal.subjectType, proposal.subjectId, proposal.evidenceRefs);
    this.repository.saveActionProposal(proposal);
  }
  saveApprovalDecision(input: ApprovalDecision): void { this.repository.saveApprovalDecision(approvalDecisionSchema.parse(input)); }
  saveExecutionRecord(input: ExecutionRecord): ExecutionRecord {
    return this.repository.saveExecutionRecord(executionRecordSchema.parse(input));
  }
  updateExecutionRecord(input: ExecutionRecord): ExecutionRecord { return this.repository.updateExecutionRecord(executionRecordSchema.parse(input)); }
  listExecutionRecords(actionId: string): ExecutionRecord[] { return this.repository.listExecutionRecords(actionId); }
  getExecutionRecord(id: string): ExecutionRecord | null { return this.repository.getExecutionRecord(id); }
  getExecutionRecordByIdempotencyKey(idempotencyKey: string): ExecutionRecord | null {
    return this.repository.getExecutionRecordByIdempotencyKey(idempotencyKey);
  }
  saveVerificationResult(input: VerificationResult): void { this.repository.saveVerificationResult(verificationResultSchema.parse(input)); }
  listVerificationResults(actionId: string): VerificationResult[] { return this.repository.listVerificationResults(actionId); }
  getVerificationResult(id: string): VerificationResult | null { return this.repository.getVerificationResult(id); }
  getVerificationByIdempotencyKey(key: string): VerificationResult | null { return this.repository.getVerificationByIdempotencyKey(key); }
  saveReasoningRun(input: ReasoningRun): void { this.repository.saveReasoningRun(reasoningRunSchema.parse(input)); }
  getReasoningRun(id: string): ReasoningRun | null { return this.repository.getReasoningRun(id); }
  appendAuditEvent(input: AuditEvent): void { this.repository.appendAuditEvent(auditEventSchema.parse(input)); }
  listAuditEvents(subjectType: AuditEvent["subjectType"], subjectId: string): AuditEvent[] {
    return this.repository.listAuditEvents(subjectType, subjectId);
  }
}

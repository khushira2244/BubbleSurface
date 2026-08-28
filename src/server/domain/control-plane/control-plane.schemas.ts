import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const timestamp = z.iso.datetime();
const jsonRecord = z.record(z.string(), z.unknown());
export const controlSubjectTypeSchema = z.enum(["INCIDENT", "FINDING"]);

export const actionProposalSchema = z.object({
  id, subjectType: controlSubjectTypeSchema, subjectId: id, actionType: id,
  parameters: jsonRecord, rationale: z.string().trim().min(1), evidenceRefs: z.array(id),
  proposalVersion: z.number().int().positive(), status: z.enum(["PROPOSED", "SUPERSEDED", "WITHDRAWN"]),
  createdBy: id, createdAt: timestamp, updatedAt: timestamp,
});
export const approvalDecisionSchema = z.object({
  id, actionId: id, proposalVersion: z.number().int().positive(),
  decision: z.enum(["APPROVED", "REJECTED", "MODIFIED"]), actorId: id,
  reason: z.string().nullable(), decidedAt: timestamp,
});
export const executionRecordSchema = z.object({
  id, actionId: id, proposalVersion: z.number().int().positive(), targetIdentifier: id,
  requestParameters: jsonRecord, idempotencyKey: id,
  status: z.enum(["PENDING", "IN_PROGRESS", "SUCCEEDED", "FAILED", "UNKNOWN"]),
  startedAt: timestamp.nullable(), completedAt: timestamp.nullable(), error: jsonRecord.nullable(),
  result: jsonRecord.nullable().optional(), externalAdapter: z.string().nullable(),
});
export const verificationResultSchema = z.object({
  id, subjectType: controlSubjectTypeSchema, subjectId: id, actionId: id,
  proposalVersion: z.number().int().positive().optional(), executionId: id.nullable().optional(),
  verificationType: id, expectedState: jsonRecord, observedState: jsonRecord,
  success: z.boolean(), checkedAt: timestamp, details: jsonRecord,
  actorId: id.optional(), source: id.optional(), startedAt: timestamp.optional(),
  failureClassification: z.string().nullable().optional(), idempotencyKey: id.optional(),
});
export const reasoningRunSchema = z.object({
  id, subjectType: controlSubjectTypeSchema, subjectId: id,
  status: z.enum(["PENDING", "COMPLETED", "FAILED"]), inputHash: id,
  lifecycleVersion: z.number().int().positive(), promptVersion: id,
  output: jsonRecord.nullable(), model: z.string().nullable(), latencyMs: z.number().int().nonnegative(),
  usage: jsonRecord.nullable(), failureClassification: z.string().nullable(),
  createdAt: timestamp, completedAt: timestamp.nullable(),
});
export const auditEventSchema = z.object({
  id, subjectType: controlSubjectTypeSchema, subjectId: id,
  actorType: z.enum(["AI", "HUMAN", "WEBMCP", "SYSTEM"]), actorId: z.string().nullable(),
  eventType: id, actionId: z.string().nullable(), proposalVersion: z.number().int().positive().nullable(),
  executionId: z.string().nullable(), lifecycleVersion: z.number().int().positive().nullable(),
  source: id, metadata: jsonRecord, occurredAt: timestamp,
});

export type ActionProposal = z.infer<typeof actionProposalSchema>;
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
export type ExecutionRecord = z.infer<typeof executionRecordSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type ReasoningRun = z.infer<typeof reasoningRunSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;

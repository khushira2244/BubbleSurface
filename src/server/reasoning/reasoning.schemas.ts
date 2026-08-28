import { z } from "zod";
import { severitySchema } from "../domain/security/security.schemas";

const id = z.string().trim().min(1).max(100);
const revokeSessionsAction = z.object({
  actionType: z.literal("REVOKE_SESSIONS"), parameters: z.object({ sessionIds: z.array(id).min(1) }).strict(),
  rationale: z.string().trim().min(1).max(1000), evidenceRefs: z.array(id).min(1),
}).strict();
const removePrivilegeAction = z.object({
  actionType: z.literal("REMOVE_PRIVILEGE"), parameters: z.object({ privilegeIds: z.array(id).min(1) }).strict(),
  rationale: z.string().trim().min(1).max(1000), evidenceRefs: z.array(id).min(1),
}).strict();

export const reasoningAssessmentSchema = z.object({
  riskAssessment: severitySchema,
  confidence: z.number().min(0).max(1),
  likelyAttackPath: z.string().trim().min(1).max(1500),
  correlatedEvidence: z.array(id),
  missingEvidence: z.array(z.string().trim().min(1).max(500)),
  recommendation: z.string().trim().min(1).max(1500),
  proposedActions: z.array(z.discriminatedUnion("actionType", [revokeSessionsAction, removePrivilegeAction])),
}).strict();

export type ReasoningAssessment = z.infer<typeof reasoningAssessmentSchema>;

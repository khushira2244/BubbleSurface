import { z } from "zod";
import { caseStateSchema } from "../domain/lifecycle/lifecycle.types";
import { severitySchema } from "../domain/security/security.schemas";

export const toolClassificationSchema = z.enum(["READ", "PREPARE", "EXECUTE", "VERIFY"]);
export const webMcpToolNameSchema = z.enum([
  "inspect_incident", "get_active_sessions", "get_device_context", "check_privilege_changes",
  "review_evidence_timeline", "prepare_containment", "revoke_approved_sessions",
  "remove_approved_privilege", "verify_containment", "verify_identity_state",
]);
export type WebMcpToolName = z.infer<typeof webMcpToolNameSchema>;
export type ToolClassification = z.infer<typeof toolClassificationSchema>;

export const capabilityContextSchema = z.object({
  subjectType: z.enum(["INCIDENT", "FINDING"]), subjectId: z.string(),
  lifecycleState: caseStateSchema, lifecycleVersion: z.number().int().positive(),
  incidentOrFindingType: z.string(), evidenceState: z.enum(["NONE", "PARTIAL", "SUFFICIENT"]),
  analystPermissions: z.array(z.enum(["INVESTIGATE", "PREPARE", "APPROVE", "EXECUTE", "VERIFY"])),
  proposalState: z.enum(["NONE", "PROPOSED", "SUPERSEDED", "WITHDRAWN"]),
  proposalActionId: z.string().nullable(), proposalActionType: z.string().nullable(),
  proposalVersion: z.number().int().positive().nullable(),
  approvalState: z.enum(["NONE", "APPROVED", "REJECTED", "MODIFIED"]),
  executionState: z.enum(["NONE", "PENDING", "IN_PROGRESS", "SUCCEEDED", "FAILED", "UNKNOWN"]),
  verificationState: z.enum(["NONE", "SUCCEEDED", "FAILED"]),
  targetRiskLevel: severitySchema.nullable(),
  proposalAuthorities: z.array(z.object({
    actionId: z.string(), actionType: z.string(), proposalVersion: z.number().int().positive(),
    proposalState: z.enum(["PROPOSED", "SUPERSEDED", "WITHDRAWN"]),
    approvalState: z.enum(["NONE", "APPROVED", "REJECTED", "MODIFIED"]),
    executionState: z.enum(["NONE", "PENDING", "IN_PROGRESS", "SUCCEEDED", "FAILED", "UNKNOWN"]),
  })),
});
export type CapabilityContext = z.infer<typeof capabilityContextSchema>;

export interface CapabilityDecision {
  toolName: WebMcpToolName; classification: ToolClassification; allowed: boolean;
  reasonCode: string; reason: string;
}
export interface CapabilityEvaluation { allowed: CapabilityDecision[]; locked: CapabilityDecision[] }

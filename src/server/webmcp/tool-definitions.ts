import { z } from "zod";
import type { IdentityProvider, SecurityEventSource } from "../integrations/security-ports";
import type { SecurityContextService } from "../domain/security/security-context.service";
import { TOOL_METADATA } from "./tool-metadata";
import type { WebMcpToolDefinition } from "./webmcp-tool.types";
import type { WebMcpToolName } from "./capability.types";
import type { EvidenceReferenceValidator } from "../domain/control-plane/evidence-reference.validator";

const baseInput = z.object({ subjectId: z.string().min(1), expectedLifecycleVersion: z.number().int().positive() }).strict();
const deviceInput = baseInput.extend({ deviceId: z.string().min(1) }).strict();
const prepareInput = baseInput.extend({ requestedActions: z.array(z.enum(["REVOKE_SESSIONS", "REMOVE_PRIVILEGE"])).min(1),
  evidenceRefs: z.array(z.string().min(1)).min(1) }).strict();
const actionInput = baseInput.extend({ actionId: z.string().min(1), proposalVersion: z.number().int().positive(),
  idempotencyKey: z.string().min(8).max(200) }).strict();
const factsOutput = z.object({ kind: z.string(), facts: z.unknown() });
const boundaryOutput = z.object({ status: z.literal("NOT_EXECUTED"), boundary: z.string(), message: z.string() });
const draftOutput = z.object({ status: z.literal("REVIEW_REQUIRED"), subjectId: z.string(), state:z.literal("AWAITING_APPROVAL"), lifecycleVersion: z.number().int().positive(),
  proposals:z.array(z.object({actionId:z.string(),proposalVersion:z.number().int().positive(),actionType:z.string(),target:z.record(z.string(),z.unknown()),reviewRequired:z.literal(true)})) });

export class ToolTargetNotRelatedError extends Error {
  readonly code = "TOOL_TARGET_NOT_RELATED";
}

export function createWebMcpToolDefinitions(dependencies: {
  securityContext: SecurityContextService; identityProvider: IdentityProvider; eventSource: SecurityEventSource;
  evidenceValidator: EvidenceReferenceValidator;
  completeInvestigation?: (subjectId:string,expectedLifecycleVersion:number,actorId:string)=>unknown;
  prepareContainment?: (input:z.infer<typeof prepareInput>,actorId:string)=>unknown;
  executeApprovedAction?: (input: {subjectId:string;expectedLifecycleVersion:number;actionId:string;proposalVersion:number;idempotencyKey:string}, actorId:string, actionType:"REVOKE_SESSIONS"|"REMOVE_PRIVILEGE") => Promise<unknown>;
  verifyApprovedAction?: (input: {subjectId:string;expectedLifecycleVersion:number;actionId:string;proposalVersion:number;idempotencyKey:string}, actorId:string, kind:"VERIFY_CONTAINMENT"|"VERIFY_IDENTITY_STATE") => Promise<unknown> | unknown;
}): Record<WebMcpToolName, WebMcpToolDefinition> {
  const define = (name: WebMcpToolName, inputSchema: z.ZodType, outputSchema: z.ZodType,
    execute: WebMcpToolDefinition["execute"]): WebMcpToolDefinition => ({ name,
      description: TOOL_METADATA[name].description, classification: TOOL_METADATA[name].classification,
      applicability: { subjectTypes: ["INCIDENT"], categories: ["IDENTITY_SESSION_COMPROMISE"] },
      policyRequirements: { authoritativeVersion: true,
        permissions: [TOOL_METADATA[name].classification === "READ" ? "INVESTIGATE"
          : TOOL_METADATA[name].classification === "PREPARE" ? "PREPARE"
          : TOOL_METADATA[name].classification === "EXECUTE" ? "EXECUTE" : "VERIFY"],
        exactApproval: TOOL_METADATA[name].classification === "EXECUTE" || TOOL_METADATA[name].classification === "VERIFY" },
      verification: TOOL_METADATA[name].classification === "EXECUTE"
        ? { required: true, kinds: ["VERIFY_CONTAINMENT", "VERIFY_IDENTITY_STATE"] } : undefined,
      inputSchema, outputSchema, execute });
  return {
    inspect_incident: define("inspect_incident", baseInput, factsOutput, (raw) => {
      const input = baseInput.parse(raw);
      return { kind: "incident_context", facts: dependencies.securityContext.getIncidentContext(input.subjectId) };
    }),
    get_active_sessions: define("get_active_sessions", baseInput, factsOutput, async (raw) => {
      const input = baseInput.parse(raw), context = dependencies.securityContext.getIncidentContext(input.subjectId);
      return { kind: "active_sessions", facts: context.identity ? await dependencies.identityProvider.getActiveSessions(context.identity.id) : [] };
    }),
    get_device_context: define("get_device_context", deviceInput, factsOutput, (raw) => {
      const input = deviceInput.parse(raw), context = dependencies.securityContext.getIncidentContext(input.subjectId);
      if (!context.devices.some((device) => device.id === input.deviceId)) throw new ToolTargetNotRelatedError(`Device ${input.deviceId} is not related to incident ${input.subjectId}.`);
      return { kind: "device_context", facts: dependencies.securityContext.getDeviceContext(input.deviceId) };
    }),
    check_privilege_changes: define("check_privilege_changes", baseInput, factsOutput, async (raw) => {
      const input = baseInput.parse(raw), context = dependencies.securityContext.getIncidentContext(input.subjectId);
      return { kind: "privilege_context", facts: {
        currentPrivileges: context.identity ? await dependencies.identityProvider.getGroupsOrPrivileges(context.identity.id) : [],
        privilegeEvents: context.events.filter((event) => event.eventType.includes("PRIVILEGE")),
      } };
    }),
    review_evidence_timeline: define("review_evidence_timeline", baseInput, factsOutput, async (raw,context) => {
      const input = baseInput.parse(raw);
      const facts=await dependencies.eventSource.getEvidenceTimeline("INCIDENT", input.subjectId);
      dependencies.completeInvestigation?.(input.subjectId,input.expectedLifecycleVersion,context.actorId);
      return { kind: "evidence_timeline", facts };
    }),
    prepare_containment: define("prepare_containment", prepareInput, draftOutput, (raw,context) => {
      const input = prepareInput.parse(raw);
      dependencies.evidenceValidator.validate("INCIDENT", input.subjectId, input.evidenceRefs);
      if(!dependencies.prepareContainment) throw new Error("Containment preparation is not configured.");
      return dependencies.prepareContainment(input,context.actorId);
    }),
    revoke_approved_sessions: define("revoke_approved_sessions", actionInput, z.unknown(), async (raw,context) => dependencies.executeApprovedAction
      ? dependencies.executeApprovedAction(actionInput.parse(raw),context.actorId,"REVOKE_SESSIONS") : ({status:"NOT_EXECUTED"})),
    remove_approved_privilege: define("remove_approved_privilege", actionInput, z.unknown(), async (raw,context) => dependencies.executeApprovedAction
      ? dependencies.executeApprovedAction(actionInput.parse(raw),context.actorId,"REMOVE_PRIVILEGE") : ({status:"NOT_EXECUTED"})),
    verify_containment: define("verify_containment", actionInput, z.unknown(), async(raw,context)=>dependencies.verifyApprovedAction?dependencies.verifyApprovedAction(actionInput.parse(raw),context.actorId,"VERIFY_CONTAINMENT"):({status:"NOT_EXECUTED"})),
    verify_identity_state: define("verify_identity_state", actionInput, z.unknown(), async(raw,context)=>dependencies.verifyApprovedAction?dependencies.verifyApprovedAction(actionInput.parse(raw),context.actorId,"VERIFY_IDENTITY_STATE"):({status:"NOT_EXECUTED"})),
  };
}

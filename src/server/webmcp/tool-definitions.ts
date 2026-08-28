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
const draftOutput = z.object({ status: z.literal("DRAFT"), subjectId: z.string(), lifecycleVersion: z.number().int().positive(),
  requestedActions: z.array(z.string()), evidenceRefs: z.array(z.string()) });

export class ToolTargetNotRelatedError extends Error {
  readonly code = "TOOL_TARGET_NOT_RELATED";
}

export function createWebMcpToolDefinitions(dependencies: {
  securityContext: SecurityContextService; identityProvider: IdentityProvider; eventSource: SecurityEventSource;
  evidenceValidator: EvidenceReferenceValidator;
}): Record<WebMcpToolName, WebMcpToolDefinition> {
  const define = (name: WebMcpToolName, inputSchema: z.ZodType, outputSchema: z.ZodType,
    execute: WebMcpToolDefinition["execute"]): WebMcpToolDefinition => ({ name,
      description: TOOL_METADATA[name].description, classification: TOOL_METADATA[name].classification,
      inputSchema, outputSchema, execute });
  return {
    inspect_incident: define("inspect_incident", baseInput, factsOutput, (raw) => {
      const input = baseInput.parse(raw);
      return { kind: "incident_context", facts: dependencies.securityContext.getIncidentContext(input.subjectId) };
    }),
    get_active_sessions: define("get_active_sessions", baseInput, factsOutput, (raw) => {
      const input = baseInput.parse(raw), context = dependencies.securityContext.getIncidentContext(input.subjectId);
      return { kind: "active_sessions", facts: context.identity ? dependencies.identityProvider.getActiveSessions(context.identity.id) : [] };
    }),
    get_device_context: define("get_device_context", deviceInput, factsOutput, (raw) => {
      const input = deviceInput.parse(raw), context = dependencies.securityContext.getIncidentContext(input.subjectId);
      if (!context.devices.some((device) => device.id === input.deviceId)) throw new ToolTargetNotRelatedError(`Device ${input.deviceId} is not related to incident ${input.subjectId}.`);
      return { kind: "device_context", facts: dependencies.securityContext.getDeviceContext(input.deviceId) };
    }),
    check_privilege_changes: define("check_privilege_changes", baseInput, factsOutput, (raw) => {
      const input = baseInput.parse(raw), context = dependencies.securityContext.getIncidentContext(input.subjectId);
      return { kind: "privilege_context", facts: {
        currentPrivileges: context.privileges,
        privilegeEvents: context.events.filter((event) => event.eventType.includes("PRIVILEGE")),
      } };
    }),
    review_evidence_timeline: define("review_evidence_timeline", baseInput, factsOutput, async (raw) => {
      const input = baseInput.parse(raw);
      return { kind: "evidence_timeline", facts: await dependencies.eventSource.getEvidenceTimeline("INCIDENT", input.subjectId) };
    }),
    prepare_containment: define("prepare_containment", prepareInput, draftOutput, (raw) => {
      const input = prepareInput.parse(raw);
      dependencies.evidenceValidator.validate("INCIDENT", input.subjectId, input.evidenceRefs);
      return { status: "DRAFT", subjectId: input.subjectId, lifecycleVersion: input.expectedLifecycleVersion,
        requestedActions: input.requestedActions, evidenceRefs: input.evidenceRefs };
    }),
    revoke_approved_sessions: define("revoke_approved_sessions", actionInput, boundaryOutput, () => ({
      status: "NOT_EXECUTED", boundary: "REMEDIATION_EXECUTION", message: "No session side effect is implemented in Day 1.",
    })),
    remove_approved_privilege: define("remove_approved_privilege", actionInput, boundaryOutput, () => ({
      status: "NOT_EXECUTED", boundary: "REMEDIATION_EXECUTION", message: "No privilege side effect is implemented in Day 1.",
    })),
    verify_containment: define("verify_containment", actionInput, boundaryOutput, () => ({
      status: "NOT_EXECUTED", boundary: "VERIFICATION", message: "Verification execution is intentionally deferred.",
    })),
    verify_identity_state: define("verify_identity_state", actionInput, boundaryOutput, () => ({
      status: "NOT_EXECUTED", boundary: "VERIFICATION", message: "Verification execution is intentionally deferred.",
    })),
  };
}

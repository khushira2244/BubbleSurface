import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { ControlPlaneService } from "../domain/control-plane/control-plane.service";
import type { EvidenceReferenceValidator } from "../domain/control-plane/evidence-reference.validator";
import type { SecurityContextService } from "../domain/security/security-context.service";
import type { SecurityEventSource } from "../integrations/security-ports";
import { OpenAiResponsesApiError, type ReasoningModelClient } from "./openai-responses.client";
import { reasoningAssessmentSchema, type ReasoningAssessment } from "./reasoning.schemas";
import { EmptyReasoningEvidenceError, MalformedReasoningOutputError, ReasoningError,
  ReasoningProviderError, StaleReasoningLifecycleError, UnsupportedReasoningActionError } from "./reasoning.errors";

const PROMPT_VERSION = "security-reasoning-v1";
const INSTRUCTIONS = `Assess only the supplied authoritative incident context. Return the requested structured object.
Reference evidence by ID only. Do not include private chain-of-thought. Suggest only REVOKE_SESSIONS or REMOVE_PRIVILEGE actions; never approve or execute.`;

export class SecurityReasoningService {
  constructor(private readonly security: SecurityContextService, private readonly events: SecurityEventSource,
    private readonly evidence: EvidenceReferenceValidator, private readonly controlPlane: ControlPlaneService,
    private readonly modelClient: ReasoningModelClient) {}

  async reasonIncident(subjectId: string, expectedVersion?: number) {
    const started = Date.now(), createdAt = new Date().toISOString(), reasoningRunId = randomUUID();
    const context = this.security.getIncidentContext(subjectId);
    const lifecycleVersion = context.lifecycle.version;
    if (expectedVersion !== undefined && expectedVersion !== lifecycleVersion) {
      throw new StaleReasoningLifecycleError(expectedVersion, lifecycleVersion);
    }
    let inputHash = createHash("sha256").update(JSON.stringify({ lifecycle: context.lifecycle,
      incident: context.incident })).digest("hex");
    let model: string | null = null;
    let usage: Record<string, unknown> | null = null;
    try {
      const timeline = await this.events.getEvidenceTimeline("INCIDENT", subjectId);
      if (!context.evidence.length) throw new EmptyReasoningEvidenceError();
      const snapshot = { lifecycle: context.lifecycle, incident: context.incident, identity: context.identity,
        devices: context.devices, sessions: context.sessions, privileges: context.privileges, assets: context.assets,
        events: timeline.events, evidence: context.evidence };
      inputHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
      let response;
      try {
        response = await this.modelClient.createStructuredResponse({ instructions: INSTRUCTIONS, context: snapshot,
          schema: z.toJSONSchema(reasoningAssessmentSchema) as Record<string, unknown> });
      } catch (error) {
        if (error instanceof ReasoningError) throw error;
        const timeout = error instanceof Error && error.name === "AbortError";
        if (error instanceof OpenAiResponsesApiError) throw new ReasoningProviderError();
        throw new ReasoningProviderError(timeout ? "REASONING_TIMEOUT" : undefined,
          timeout ? "The reasoning provider timed out." : undefined);
      }
      model = response.model; usage = response.usage;
      let raw: unknown;
      try { raw = JSON.parse(response.outputText); } catch { throw new MalformedReasoningOutputError(); }
      this.rejectUnsupportedActionTypes(raw);
      const assessment = this.parseAssessment(raw);
      this.validateAssessment(context, assessment);
      const currentVersion = this.security.getIncident(subjectId).lifecycle.version;
      if (currentVersion !== lifecycleVersion) throw new StaleReasoningLifecycleError(lifecycleVersion, currentVersion);
      const completedAt = new Date().toISOString();
      this.controlPlane.saveReasoningRun({ id: reasoningRunId, subjectType: "INCIDENT", subjectId,
        lifecycleVersion, promptVersion: PROMPT_VERSION, status: "COMPLETED", inputHash,
        output: assessment, model, latencyMs: Date.now() - started, usage, failureClassification: null,
        createdAt, completedAt });
      const proposals = assessment.proposedActions.map((action, index) => {
        const actionId = `ACT-AI-${createHash("sha256").update(`${reasoningRunId}:${index}`).digest("hex").slice(0, 16)}`;
        const proposal = { id: actionId, proposalVersion: 1, subjectType: "INCIDENT" as const, subjectId,
          actionType: action.actionType, parameters: { ...action.parameters, lifecycleVersion },
          rationale: action.rationale, evidenceRefs: action.evidenceRefs, status: "PROPOSED" as const,
          createdBy: "AI", createdAt: completedAt, updatedAt: completedAt };
        this.controlPlane.saveActionProposal(proposal);
        return proposal;
      });
      return { reasoningRunId, lifecycleVersion, assessment, proposals };
    } catch (error) {
      const classified = this.classify(error);
      this.controlPlane.saveReasoningRun({ id: reasoningRunId, subjectType: "INCIDENT", subjectId,
        lifecycleVersion, promptVersion: PROMPT_VERSION, status: "FAILED", inputHash,
        output: null, model, latencyMs: Date.now() - started, usage,
        failureClassification: classified, createdAt, completedAt: new Date().toISOString() });
      throw error;
    }
  }

  private parseAssessment(raw: unknown): ReasoningAssessment {
    const parsed = reasoningAssessmentSchema.safeParse(raw);
    if (!parsed.success) throw new MalformedReasoningOutputError();
    return parsed.data;
  }
  private rejectUnsupportedActionTypes(raw: unknown): void {
    if (!raw || typeof raw !== "object" || !Array.isArray((raw as { proposedActions?: unknown }).proposedActions)) return;
    for (const action of (raw as { proposedActions: unknown[] }).proposedActions) {
      const type = action && typeof action === "object" ? (action as { actionType?: unknown }).actionType : undefined;
      if (type !== "REVOKE_SESSIONS" && type !== "REMOVE_PRIVILEGE") {
        throw new UnsupportedReasoningActionError(`Action type ${String(type)} is not supported.`);
      }
    }
  }
  private validateAssessment(context: ReturnType<SecurityContextService["getIncidentContext"]>, assessment: ReasoningAssessment): void {
    const refs = [...assessment.correlatedEvidence, ...assessment.proposedActions.flatMap((action) => action.evidenceRefs)];
    this.evidence.validate("INCIDENT", context.incident.id, refs);
    const sessions = new Set(context.sessions.map((session) => session.id));
    const privileges = new Set(context.privileges.map((privilege) => privilege.id));
    for (const action of assessment.proposedActions) {
      const targets = action.actionType === "REVOKE_SESSIONS" ? action.parameters.sessionIds : action.parameters.privilegeIds;
      const allowed = action.actionType === "REVOKE_SESSIONS" ? sessions : privileges;
      const invalid = targets.filter((target) => !allowed.has(target));
      if (invalid.length) throw new UnsupportedReasoningActionError(`Action targets are not related to this incident: ${invalid.join(", ")}.`);
    }
  }
  private classify(error: unknown): string {
    if (error instanceof ReasoningError) return error.code;
    if (error && typeof error === "object" && "code" in error) return String(error.code);
    return "REASONING_FAILED";
  }
}

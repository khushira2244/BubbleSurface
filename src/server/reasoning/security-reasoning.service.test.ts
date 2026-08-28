import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeSecuritySchema } from "../db/security-schema";
import { ControlPlaneService } from "../domain/control-plane/control-plane.service";
import { EvidenceReferenceValidator, InvalidEvidenceReferenceError } from "../domain/control-plane/evidence-reference.validator";
import { SecurityContextService } from "../domain/security/security-context.service";
import { SqliteSecurityEventAdapter } from "../integrations/sqlite-security-event.adapter";
import { SqliteControlPlaneRepository } from "../repositories/sqlite-control-plane.repository";
import { SqliteSecurityContextRepository } from "../repositories/sqlite-security-context.repository";
import { seedSecurityData } from "../seed/seed-security-data";
import type { ReasoningModelClient } from "./openai-responses.client";
import { MalformedReasoningOutputError, UnsupportedReasoningActionError } from "./reasoning.errors";
import { SecurityReasoningService } from "./security-reasoning.service";

const validAssessment = { riskAssessment: "CRITICAL", confidence: 0.94,
  likelyAttackPath: "Unfamiliar login created a persistent session before an unauthorized privilege grant.",
  correlatedEvidence: ["EVD-1001", "EVD-1003"], missingEvidence: ["User confirmation"],
  recommendation: "Prepare containment for human review.", proposedActions: [{ actionType: "REVOKE_SESSIONS",
    parameters: { sessionIds: ["SES-ASHA-SUSPICIOUS"] }, rationale: "Stop the suspicious active session.",
    evidenceRefs: ["EVD-1001", "EVD-1004"] }] };

describe("SecurityReasoningService", () => {
  let db: Database.Database, repository: SqliteControlPlaneRepository;
  beforeEach(() => { db = new Database(":memory:"); initializeSecuritySchema(db); seedSecurityData(db);
    repository = new SqliteControlPlaneRepository(db); });
  afterEach(() => db.close());

  const service = (output: unknown) => {
    const securityRepository = new SqliteSecurityContextRepository(db);
    const model: ReasoningModelClient = { createStructuredResponse: async () => ({ model: "test-model",
      outputText: typeof output === "string" ? output : JSON.stringify(output), usage: { total_tokens: 42 } }) };
    return new SecurityReasoningService(new SecurityContextService(securityRepository),
      new SqliteSecurityEventAdapter(db), new EvidenceReferenceValidator(securityRepository),
      new ControlPlaneService(repository, new EvidenceReferenceValidator(securityRepository)), model);
  };

  it("accepts valid structured output, persists the run, and creates only an AI proposal", async () => {
    const result = await service(validAssessment).reasonIncident("INC-1001", 3);
    expect(result.assessment).toEqual(validAssessment);
    expect(repository.getReasoningRun(result.reasoningRunId)).toMatchObject({ status: "COMPLETED",
      lifecycleVersion: 3, promptVersion: "security-reasoning-v1", model: "test-model" });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({ status: "PROPOSED", createdBy: "AI", proposalVersion: 1 });
    expect(repository.getActionProposal(result.proposals[0].id, 1)).toEqual(result.proposals[0]);
    expect(db.prepare("SELECT COUNT(*) count FROM approval_decisions").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) count FROM execution_records").get()).toEqual({ count: 0 });
  });

  it("rejects malformed structured model output and persists a failed run", async () => {
    await expect(service("not-json").reasonIncident("INC-1001")).rejects.toBeInstanceOf(MalformedReasoningOutputError);
    expect(db.prepare("SELECT status,failure_classification FROM reasoning_runs").get())
      .toEqual({ status: "FAILED", failure_classification: "MALFORMED_REASONING_OUTPUT" });
  });

  it("rejects fabricated evidence", async () => {
    await expect(service({ ...validAssessment, correlatedEvidence: ["EVD-FAKE-999"] })
      .reasonIncident("INC-1001")).rejects.toBeInstanceOf(InvalidEvidenceReferenceError);
    expect(db.prepare("SELECT COUNT(*) count FROM action_proposals").get()).toEqual({ count: 0 });
  });

  it("rejects unsupported action types", async () => {
    const output = { ...validAssessment, proposedActions: [{ actionType: "DISABLE_USER", parameters: {},
      rationale: "Unsupported", evidenceRefs: ["EVD-1001"] }] };
    await expect(service(output).reasonIncident("INC-1001")).rejects.toBeInstanceOf(UnsupportedReasoningActionError);
  });

  it("rejects proposed actions targeting entities outside the incident", async () => {
    const output = { ...validAssessment, proposedActions: [{ ...validAssessment.proposedActions[0],
      parameters: { sessionIds: ["SES-UNKNOWN"] } }] };
    await expect(service(output).reasonIncident("INC-1001")).rejects.toBeInstanceOf(UnsupportedReasoningActionError);
  });
});

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeSecuritySchema } from "../../db/security-schema";
import { SqliteControlPlaneRepository } from "../../repositories/sqlite-control-plane.repository";
import { SqliteSecurityContextRepository } from "../../repositories/sqlite-security-context.repository";
import { seedSecurityData } from "../../seed/seed-security-data";
import type { ActionProposal } from "./control-plane.schemas";
import { ControlPlaneService } from "./control-plane.service";
import { EvidenceReferenceValidator, InvalidEvidenceReferenceError } from "./evidence-reference.validator";

describe("control-plane foundation", () => {
  let db: Database.Database;
  let repository: SqliteControlPlaneRepository;
  let service: ControlPlaneService;
  const proposal: ActionProposal = {
    id: "ACT-1001", subjectType: "INCIDENT", subjectId: "INC-1001",
    actionType: "REVOKE_SESSIONS", parameters: { sessionIds: ["SES-ASHA-SUSPICIOUS"] },
    rationale: "Contain the suspicious session after human review.", evidenceRefs: ["EVD-1001", "EVD-1004"],
    proposalVersion: 1, status: "PROPOSED", createdBy: "AI-REASONER",
    createdAt: "2026-08-27T07:00:00.000Z", updatedAt: "2026-08-27T07:00:00.000Z",
  };
  beforeEach(() => {
    db = new Database(":memory:"); initializeSecuritySchema(db); seedSecurityData(db);
    repository = new SqliteControlPlaneRepository(db);
    service = new ControlPlaneService(repository,
      new EvidenceReferenceValidator(new SqliteSecurityContextRepository(db)));
  });
  afterEach(() => db.close());

  it("persists a proposal with an exact version and valid evidence", () => {
    service.saveActionProposal(proposal);
    expect(repository.getActionProposal("ACT-1001", 1)).toEqual(proposal);
  });

  it("rejects invented or cross-subject evidence references", () => {
    expect(() => service.saveActionProposal({ ...proposal, evidenceRefs: ["EVD-2001", "EVD-MISSING"] }))
      .toThrow(InvalidEvidenceReferenceError);
    expect(repository.getActionProposal("ACT-1001", 1)).toBeNull();
  });

  it("recognizes a persisted execution contract by stable idempotency key", () => {
    service.saveActionProposal(proposal);
    const execution = { id: "EXE-1001", actionId: proposal.id, proposalVersion: 1,
      targetIdentifier: "SES-ASHA-SUSPICIOUS", requestParameters: { sessionIds: ["SES-ASHA-SUSPICIOUS"] },
      idempotencyKey: "idem-action-1001", status: "PENDING" as const, startedAt: null, completedAt: null,
      error: null, externalAdapter: null };
    expect(service.saveExecutionRecord(execution)).toEqual(execution);
    expect(service.getExecutionRecordByIdempotencyKey("idem-action-1001")).toEqual(execution);
    expect(service.saveExecutionRecord({ ...execution, id: "EXE-REPLAY" })).toEqual(execution);
    expect(db.prepare("SELECT COUNT(*) AS count FROM execution_records WHERE idempotency_key = ?")
      .get("idem-action-1001")).toEqual({ count: 1 });
  });
});

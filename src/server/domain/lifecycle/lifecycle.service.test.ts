import { describe, expect, it } from "vitest";
import { InvalidLifecycleTransitionError, StaleCaseVersionError } from "./lifecycle.errors";
import type { CaseRepository, CreateCaseInput, TransitionCaseInput } from "./lifecycle.repository";
import { LifecycleService } from "./lifecycle.service";
import type { LifecycleEvent, SecurityCase } from "./lifecycle.types";

class MemoryCaseRepository implements CaseRepository {
  private readonly records = new Map<string, SecurityCase>();
  create(input: CreateCaseInput): SecurityCase {
    const now = new Date().toISOString();
    const record: SecurityCase = { ...input, state: "NEW", version: 1, createdAt: now, updatedAt: now };
    this.records.set(`${input.type}:${input.id}`, record);
    return record;
  }
  findById(caseId: string, caseType: SecurityCase["type"]): SecurityCase | null {
    return this.records.get(`${caseType}:${caseId}`) ?? null;
  }
  transition(input: TransitionCaseInput): { case: SecurityCase; event: LifecycleEvent } {
    const current = this.findById(input.caseId, input.caseType)!;
    if (current.version !== input.expectedVersion) {
      throw new StaleCaseVersionError(input.caseId, input.expectedVersion, current.version);
    }
    const next = { ...current, state: input.toState, version: current.version + 1, updatedAt: input.occurredAt };
    this.records.set(`${input.caseType}:${input.caseId}`, next);
    return { case: next, event: {
      id: "event", caseId: input.caseId, caseType: input.caseType, command: input.command,
      fromState: input.fromState, toState: input.toState, fromVersion: current.version,
      toVersion: next.version, actorId: input.actorId, occurredAt: input.occurredAt,
    } };
  }
}

const setup = (type: SecurityCase["type"] = "INCIDENT") => {
  const repository = new MemoryCaseRepository();
  const service = new LifecycleService(repository);
  return { repository, service, securityCase: service.createCase(type, "Test security case") };
};

describe("LifecycleService", () => {
  it("moves an incident through a named transition and increments its version", () => {
    const { service, securityCase } = setup();
    const updated = service.execute({ caseId: securityCase.id, caseType: securityCase.type,
      command: "START_TRIAGE", expectedVersion: 1, actorId: "analyst-1" });
    expect(updated).toMatchObject({ state: "TRIAGE", version: 2 });
  });

  it("rejects a named command when the current state is invalid", () => {
    const { repository, service, securityCase } = setup();
    expect(() => service.execute({ caseId: securityCase.id, caseType: securityCase.type,
      command: "VALIDATE_CASE", expectedVersion: 1, actorId: "analyst-1" }))
      .toThrow(InvalidLifecycleTransitionError);
    expect(repository.findById(securityCase.id, securityCase.type)).toMatchObject({ state: "NEW", version: 1 });
  });

  it("allows only one transition for concurrent requests sharing expectedVersion 1", () => {
    const { repository, service, securityCase } = setup();
    const first = service.execute({ caseId: securityCase.id, caseType: securityCase.type,
      command: "START_TRIAGE", expectedVersion: 1, actorId: "analyst-1" });
    expect(() => service.execute({ caseId: securityCase.id, caseType: securityCase.type,
      command: "START_INVESTIGATION", expectedVersion: 1, actorId: "analyst-1" }))
      .toThrow(StaleCaseVersionError);
    const persisted = repository.findById(securityCase.id, securityCase.type);
    expect(first.version).toBe(2);
    expect(persisted).toMatchObject({ state: "TRIAGE", version: 2 });
  });

  it("reuses the same engine for vulnerability findings", () => {
    const { service, securityCase } = setup("VULNERABILITY_FINDING");
    const updated = service.execute({ caseId: securityCase.id, caseType: securityCase.type,
      command: "START_TRIAGE", expectedVersion: 1, actorId: "analyst-2" });
    expect(updated).toMatchObject({ type: "VULNERABILITY_FINDING", state: "TRIAGE", version: 2 });
  });
});

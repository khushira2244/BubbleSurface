import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { CaseNotFoundError, LifecyclePreconditionFailedError, StaleCaseVersionError } from "../domain/lifecycle/lifecycle.errors";
import type { CaseRepository, CreateCaseInput, TransitionCaseInput } from "../domain/lifecycle/lifecycle.repository";
import type { LifecycleEvent, SecurityCase } from "../domain/lifecycle/lifecycle.types";

type CaseRow = {
  id: string; type: SecurityCase["type"]; title: string; state: SecurityCase["state"];
  version: number; created_at: string; updated_at: string;
};
const toCase = (row: CaseRow): SecurityCase => ({ id: row.id, type: row.type, title: row.title,
  state: row.state, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at });

export class SqliteCaseRepository implements CaseRepository {
  constructor(private readonly db: Database.Database) {}
  create(input: CreateCaseInput): SecurityCase {
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO security_cases
      (id, type, title, state, version, created_at, updated_at)
      VALUES (?, ?, ?, 'NEW', 1, ?, ?)`).run(input.id, input.type, input.title, now, now);
    const created = this.findById(input.id, input.type);
    if (!created) throw new CaseNotFoundError(input.id);
    return created;
  }
  findById(caseId: string, caseType: SecurityCase["type"]): SecurityCase | null {
    const row = this.db.prepare("SELECT * FROM security_cases WHERE id = ? AND type = ?")
      .get(caseId, caseType) as CaseRow | undefined;
    return row ? toCase(row) : null;
  }
  transition(input: TransitionCaseInput): { case: SecurityCase; event: LifecycleEvent } {
    return this.db.transaction(() => {
      const current = this.findById(input.caseId, input.caseType);
      if (!current) throw new CaseNotFoundError(input.caseId);
      if (current.version !== input.expectedVersion) {
        throw new StaleCaseVersionError(input.caseId, input.expectedVersion, current.version);
      }
      const nextVersion = current.version + 1;
      const update = this.db.prepare(`UPDATE security_cases SET state = ?, version = ?, updated_at = ?
        WHERE id = ? AND type = ? AND state = ? AND version = ?`)
        .run(input.toState, nextVersion, input.occurredAt, input.caseId, input.caseType,
          input.fromState, input.expectedVersion);
      if (update.changes !== 1) {
        const refreshed = this.findById(input.caseId, input.caseType);
        if (!refreshed) throw new CaseNotFoundError(input.caseId);
        if (refreshed.version !== input.expectedVersion) {
          throw new StaleCaseVersionError(input.caseId, input.expectedVersion, refreshed.version);
        }
        throw new LifecyclePreconditionFailedError(input.caseId, input.fromState, refreshed.state);
      }
      const event: LifecycleEvent = {
        id: randomUUID(), caseId: input.caseId, caseType: input.caseType, command: input.command,
        fromState: input.fromState, toState: input.toState, fromVersion: input.expectedVersion,
        toVersion: nextVersion, actorId: input.actorId, occurredAt: input.occurredAt,
      };
      this.db.prepare(`INSERT INTO lifecycle_events
        (id, case_id, case_type, command, from_state, to_state, from_version, to_version, actor_id, occurred_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(event.id, event.caseId, event.caseType, event.command, event.fromState, event.toState,
          event.fromVersion, event.toVersion, event.actorId, event.occurredAt);
      const transitioned = this.findById(input.caseId, input.caseType);
      if (!transitioned) throw new CaseNotFoundError(input.caseId);
      return { case: transitioned, event };
    })();
  }
}

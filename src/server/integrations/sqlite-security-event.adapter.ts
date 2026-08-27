import type Database from "better-sqlite3";
import { securityEventSchema, evidenceSchema, type Evidence, type SecurityEvent } from "../domain/security/security.schemas";
import type { EventSearchQuery, SecurityEventSource } from "./security-ports";

type Row = Record<string, unknown>;
const event = (r: Row): SecurityEvent => securityEventSchema.parse({ id: r.id, subjectType: r.subject_type,
  subjectId: r.subject_id, eventType: r.event_type, occurredAt: r.occurred_at, identityId: r.identity_id,
  deviceId: r.device_id, sessionId: r.session_id, assetId: r.asset_id, source: r.source, summary: r.summary,
  attributes: JSON.parse(String(r.attributes_json)) });
const evidence = (r: Row): Evidence => evidenceSchema.parse({ id: r.id, subjectType: r.subject_type,
  subjectId: r.subject_id, eventId: r.event_id, type: r.type, summary: r.summary, source: r.source,
  observedAt: r.observed_at, details: JSON.parse(String(r.details_json)) });

export class SqliteSecurityEventAdapter implements SecurityEventSource {
  constructor(private readonly db: Database.Database) {}
  searchEvents(query: EventSearchQuery): SecurityEvent[] {
    const clauses: string[] = [], values: unknown[] = [];
    if (query.subjectType) { clauses.push("subject_type = ?"); values.push(query.subjectType); }
    if (query.subjectId) { clauses.push("subject_id = ?"); values.push(query.subjectId); }
    if (query.identityId) { clauses.push("identity_id = ?"); values.push(query.identityId); }
    if (query.from) { clauses.push("occurred_at >= ?"); values.push(query.from); }
    if (query.to) { clauses.push("occurred_at <= ?"); values.push(query.to); }
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return (this.db.prepare(`SELECT * FROM security_events ${where} ORDER BY occurred_at LIMIT ?`).all(...values, limit) as Row[]).map(event);
  }
  getEventsForIdentity(identityId: string) { return this.searchEvents({ identityId }); }
  getEventsForIncident(incidentId: string) { return this.searchEvents({ subjectType: "INCIDENT", subjectId: incidentId }); }
  getEvidenceTimeline(subjectType: "INCIDENT" | "FINDING", subjectId: string) {
    const events = this.searchEvents({ subjectType, subjectId });
    const evidenceRows = this.db.prepare("SELECT * FROM evidence WHERE subject_type = ? AND subject_id = ? ORDER BY observed_at").all(subjectType, subjectId) as Row[];
    return { events, evidence: evidenceRows.map(evidence) };
  }
}

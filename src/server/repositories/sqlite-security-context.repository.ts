import type Database from "better-sqlite3";
import type { SecurityCase } from "../domain/lifecycle/lifecycle.types";
import {
  assetSchema, deviceSchema, evidenceSchema, findingSchema, identitySchema, incidentSchema,
  privilegeSchema, securityCaseFixtureSchema, securityEventSchema, sessionSchema, vulnerabilitySchema,
  type Asset, type Device, type Evidence, type Finding, type Identity, type Incident,
  type Privilege, type SecurityEvent, type Session, type Vulnerability,
} from "../domain/security/security.schemas";
import type { SecurityContextRepository } from "../domain/security/security.repository";

type Row = Record<string, unknown>;
const rows = (value: unknown) => value as Row[];
const jsonObject = (value: unknown) => JSON.parse(String(value)) as Record<string, unknown>;

const mapCase = (r: Row): SecurityCase => securityCaseFixtureSchema.parse({ id: r.id, type: r.type,
  title: r.title, state: r.state, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at });
const mapIdentity = (r: Row): Identity => identitySchema.parse({ id: r.id, displayName: r.display_name,
  email: r.email, department: r.department, normalLocation: r.normal_location, riskLevel: r.risk_level,
  source: r.source, createdAt: r.created_at, updatedAt: r.updated_at });
const mapDevice = (r: Row): Device => deviceSchema.parse({ id: r.id, identityId: r.identity_id,
  hostname: r.hostname, platform: r.platform, trustStatus: r.trust_status, location: r.location,
  source: r.source, lastSeenAt: r.last_seen_at, createdAt: r.created_at, updatedAt: r.updated_at });
const mapSession = (r: Row): Session => sessionSchema.parse({ id: r.id, identityId: r.identity_id,
  deviceId: r.device_id, tokenType: r.token_type, status: r.status, ipAddress: r.ip_address,
  location: r.location, createdAt: r.created_at, lastSeenAt: r.last_seen_at, source: r.source });
const mapPrivilege = (r: Row): Privilege => privilegeSchema.parse({ id: r.id, identityId: r.identity_id,
  assetId: r.asset_id, name: r.name, scope: r.scope, status: r.status, grantedAt: r.granted_at,
  revokedAt: r.revoked_at, source: r.source });
const mapAsset = (r: Row): Asset => assetSchema.parse({ id: r.id, name: r.name, type: r.type,
  environment: r.environment, criticality: r.criticality, component: r.component, source: r.source,
  createdAt: r.created_at, updatedAt: r.updated_at });
const mapIncident = (r: Row): Incident => incidentSchema.parse({ id: r.id, affectedIdentityId: r.affected_identity_id,
  summary: r.summary, severity: r.severity, category: r.category, owner: r.owner, source: r.source,
  createdAt: r.created_at, updatedAt: r.updated_at });
const mapFinding = (r: Row): Finding => findingSchema.parse({ id: r.id, assetId: r.asset_id,
  summary: r.summary, severity: r.severity, status: r.status, component: r.component,
  owner: r.owner, source: r.source, createdAt: r.created_at, updatedAt: r.updated_at });
const mapVulnerability = (r: Row): Vulnerability => vulnerabilitySchema.parse({ id: r.id,
  findingId: r.finding_id, assetId: r.asset_id, title: r.title, cwe: r.cwe, endpoint: r.endpoint,
  status: r.status, description: r.description, createdAt: r.created_at, updatedAt: r.updated_at });
const mapEvent = (r: Row): SecurityEvent => securityEventSchema.parse({ id: r.id,
  subjectType: r.subject_type, subjectId: r.subject_id, eventType: r.event_type, occurredAt: r.occurred_at,
  identityId: r.identity_id, deviceId: r.device_id, sessionId: r.session_id, assetId: r.asset_id,
  source: r.source, summary: r.summary, attributes: jsonObject(r.attributes_json) });
const mapEvidence = (r: Row): Evidence => evidenceSchema.parse({ id: r.id,
  subjectType: r.subject_type, subjectId: r.subject_id, eventId: r.event_id, type: r.type,
  summary: r.summary, source: r.source, observedAt: r.observed_at, details: jsonObject(r.details_json) });

export class SqliteSecurityContextRepository implements SecurityContextRepository {
  constructor(private readonly db: Database.Database) {}
  private one(sql: string, id: string): Row | null { return (this.db.prepare(sql).get(id) as Row | undefined) ?? null; }
  getCase(id: string) { const r = this.one("SELECT * FROM security_cases WHERE id = ?", id); return r ? mapCase(r) : null; }
  getIncident(id: string) { const r = this.one("SELECT * FROM incidents WHERE id = ?", id); return r ? mapIncident(r) : null; }
  getFinding(id: string) { const r = this.one("SELECT * FROM findings WHERE id = ?", id); return r ? mapFinding(r) : null; }
  getIdentity(id: string) { const r = this.one("SELECT * FROM identities WHERE id = ?", id); return r ? mapIdentity(r) : null; }
  getDevice(id: string) { const r = this.one("SELECT * FROM devices WHERE id = ?", id); return r ? mapDevice(r) : null; }
  getAsset(id: string) { const r = this.one("SELECT * FROM assets WHERE id = ?", id); return r ? mapAsset(r) : null; }
  getActiveSessions(identityId: string) { return rows(this.db.prepare("SELECT * FROM sessions WHERE identity_id = ? AND status = 'ACTIVE' ORDER BY created_at").all(identityId)).map(mapSession); }
  getDevicesForIdentity(identityId: string) { return rows(this.db.prepare("SELECT * FROM devices WHERE identity_id = ? ORDER BY created_at").all(identityId)).map(mapDevice); }
  getPrivilegesForIdentity(identityId: string) { return rows(this.db.prepare("SELECT * FROM privileges WHERE identity_id = ? ORDER BY granted_at").all(identityId)).map(mapPrivilege); }
  getAssetsForIncident(incidentId: string) { return rows(this.db.prepare("SELECT a.* FROM assets a JOIN incident_assets ia ON ia.asset_id = a.id WHERE ia.incident_id = ? ORDER BY a.name").all(incidentId)).map(mapAsset); }
  getVulnerabilityForFinding(findingId: string) { const r = this.one("SELECT * FROM vulnerabilities WHERE finding_id = ?", findingId); return r ? mapVulnerability(r) : null; }
  getEvidenceForSubject(subjectType: "INCIDENT" | "FINDING", subjectId: string) { return rows(this.db.prepare("SELECT * FROM evidence WHERE subject_type = ? AND subject_id = ? ORDER BY observed_at").all(subjectType, subjectId)).map(mapEvidence); }
  getSecurityEventsForSubject(subjectType: "INCIDENT" | "FINDING", subjectId: string) { return rows(this.db.prepare("SELECT * FROM security_events WHERE subject_type = ? AND subject_id = ? ORDER BY occurred_at").all(subjectType, subjectId)).map(mapEvent); }
}

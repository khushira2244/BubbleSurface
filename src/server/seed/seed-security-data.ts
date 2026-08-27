import type Database from "better-sqlite3";
import { validateSecurityFixture } from "../domain/security/fixture-validator";
import { securityFixture } from "./security-fixture";

export function seedSecurityData(db: Database.Database, input: unknown = securityFixture): void {
  const fixture = validateSecurityFixture(input);
  db.transaction(() => {
    const insertCase = db.prepare("INSERT OR IGNORE INTO security_cases (id,type,title,state,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?)");
    for (const x of fixture.cases) insertCase.run(x.id, x.type, x.title, x.state, x.version, x.createdAt, x.updatedAt);
    const insertIdentity = db.prepare("INSERT OR IGNORE INTO identities (id,display_name,email,department,normal_location,risk_level,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.identities) insertIdentity.run(x.id, x.displayName, x.email, x.department, x.normalLocation, x.riskLevel, x.source, x.createdAt, x.updatedAt);
    const insertDevice = db.prepare("INSERT OR IGNORE INTO devices (id,identity_id,hostname,platform,trust_status,location,source,last_seen_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.devices) insertDevice.run(x.id, x.identityId, x.hostname, x.platform, x.trustStatus, x.location, x.source, x.lastSeenAt, x.createdAt, x.updatedAt);
    const insertAsset = db.prepare("INSERT OR IGNORE INTO assets (id,name,type,environment,criticality,component,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.assets) insertAsset.run(x.id, x.name, x.type, x.environment, x.criticality, x.component, x.source, x.createdAt, x.updatedAt);
    const insertSession = db.prepare("INSERT OR IGNORE INTO sessions (id,identity_id,device_id,token_type,status,ip_address,location,created_at,last_seen_at,source) VALUES (?,?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.sessions) insertSession.run(x.id, x.identityId, x.deviceId, x.tokenType, x.status, x.ipAddress, x.location, x.createdAt, x.lastSeenAt, x.source);
    const insertPrivilege = db.prepare("INSERT OR IGNORE INTO privileges (id,identity_id,asset_id,name,scope,status,granted_at,revoked_at,source) VALUES (?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.privileges) insertPrivilege.run(x.id, x.identityId, x.assetId, x.name, x.scope, x.status, x.grantedAt, x.revokedAt, x.source);
    const insertIncident = db.prepare("INSERT OR IGNORE INTO incidents (id,affected_identity_id,summary,severity,category,owner,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.incidents) insertIncident.run(x.id, x.affectedIdentityId, x.summary, x.severity, x.category, x.owner, x.source, x.createdAt, x.updatedAt);
    const insertFinding = db.prepare("INSERT OR IGNORE INTO findings (id,asset_id,summary,severity,status,component,owner,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.findings) insertFinding.run(x.id, x.assetId, x.summary, x.severity, x.status, x.component, x.owner, x.source, x.createdAt, x.updatedAt);
    const insertVulnerability = db.prepare("INSERT OR IGNORE INTO vulnerabilities (id,finding_id,asset_id,title,cwe,endpoint,status,description,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.vulnerabilities) insertVulnerability.run(x.id, x.findingId, x.assetId, x.title, x.cwe, x.endpoint, x.status, x.description, x.createdAt, x.updatedAt);
    const insertRelation = db.prepare("INSERT OR IGNORE INTO incident_assets (incident_id,asset_id) VALUES (?,?)");
    for (const x of fixture.incidentAssets) insertRelation.run(x.incidentId, x.assetId);
    const insertEvent = db.prepare("INSERT OR IGNORE INTO security_events (id,subject_type,subject_id,event_type,occurred_at,identity_id,device_id,session_id,asset_id,source,summary,attributes_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.events) insertEvent.run(x.id, x.subjectType, x.subjectId, x.eventType, x.occurredAt, x.identityId, x.deviceId, x.sessionId, x.assetId, x.source, x.summary, JSON.stringify(x.attributes));
    const insertEvidence = db.prepare("INSERT OR IGNORE INTO evidence (id,subject_type,subject_id,event_id,type,summary,source,observed_at,details_json) VALUES (?,?,?,?,?,?,?,?,?)");
    for (const x of fixture.evidence) insertEvidence.run(x.id, x.subjectType, x.subjectId, x.eventId, x.type, x.summary, x.source, x.observedAt, JSON.stringify(x.details));
  })();
}

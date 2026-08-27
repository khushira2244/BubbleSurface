import { z } from "zod";
import { caseStateSchema } from "../lifecycle/lifecycle.types";
import type { SecurityCase } from "../lifecycle/lifecycle.types";

const id = z.string().trim().min(1);
const timestamp = z.iso.datetime();
const optionalId = id.nullable();

export const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const subjectTypeSchema = z.enum(["INCIDENT", "FINDING"]);

export const securityCaseFixtureSchema = z.object({
  id, type: z.enum(["INCIDENT", "VULNERABILITY_FINDING"]), title: z.string().min(3),
  state: caseStateSchema, version: z.number().int().positive(), createdAt: timestamp, updatedAt: timestamp,
});
export const identitySchema = z.object({ id, displayName: z.string(), email: z.email(), department: z.string(),
  normalLocation: z.string(), riskLevel: severitySchema, source: z.string(), createdAt: timestamp, updatedAt: timestamp });
export const deviceSchema = z.object({ id, identityId: id, hostname: z.string(), platform: z.string(),
  trustStatus: z.enum(["TRUSTED", "UNKNOWN", "UNTRUSTED"]), location: z.string(),
  source: z.string(), lastSeenAt: timestamp, createdAt: timestamp, updatedAt: timestamp });
export const sessionSchema = z.object({ id, identityId: id, deviceId: optionalId, tokenType: z.string(),
  status: z.enum(["ACTIVE", "REVOKED", "EXPIRED"]), ipAddress: z.string(), location: z.string(),
  createdAt: timestamp, lastSeenAt: timestamp, source: z.string() });
export const assetSchema = z.object({ id, name: z.string(), type: z.string(), environment: z.string(),
  criticality: severitySchema, component: z.string().nullable(), source: z.string(), createdAt: timestamp, updatedAt: timestamp });
export const privilegeSchema = z.object({ id, identityId: id, assetId: optionalId, name: z.string(),
  scope: z.string(), status: z.enum(["ACTIVE", "REVOKED"]), grantedAt: timestamp,
  revokedAt: timestamp.nullable(), source: z.string() });
export const incidentSchema = z.object({ id, affectedIdentityId: optionalId, summary: z.string(),
  severity: severitySchema, category: z.string(), owner: z.string().nullable(), source: z.string(),
  createdAt: timestamp, updatedAt: timestamp });
export const findingSchema = z.object({ id, assetId: id, summary: z.string(), severity: severitySchema,
  status: z.enum(["POTENTIAL", "INVESTIGATING", "CONFIRMED", "REMEDIATED", "CLOSED"]),
  component: z.string(), owner: z.string().nullable(), source: z.string(), createdAt: timestamp, updatedAt: timestamp });
export const vulnerabilitySchema = z.object({ id, findingId: id, assetId: id, title: z.string(),
  cwe: z.string().nullable(), endpoint: z.string().nullable(), status: z.enum(["POTENTIAL", "VALIDATING", "CONFIRMED", "FIXED"]),
  description: z.string(), createdAt: timestamp, updatedAt: timestamp });
export const securityEventSchema = z.object({ id, subjectType: subjectTypeSchema, subjectId: id,
  eventType: z.string(), occurredAt: timestamp, identityId: optionalId, deviceId: optionalId,
  sessionId: optionalId, assetId: optionalId, source: z.string(), summary: z.string(),
  attributes: z.record(z.string(), z.unknown()) });
export const evidenceSchema = z.object({ id, subjectType: subjectTypeSchema, subjectId: id,
  eventId: optionalId, type: z.string(), summary: z.string(), source: z.string(),
  observedAt: timestamp, details: z.record(z.string(), z.unknown()) });

export const securityFixtureSchema = z.object({
  cases: z.array(securityCaseFixtureSchema), incidents: z.array(incidentSchema), findings: z.array(findingSchema),
  identities: z.array(identitySchema), devices: z.array(deviceSchema), sessions: z.array(sessionSchema),
  privileges: z.array(privilegeSchema), assets: z.array(assetSchema), vulnerabilities: z.array(vulnerabilitySchema),
  events: z.array(securityEventSchema), evidence: z.array(evidenceSchema),
  incidentAssets: z.array(z.object({ incidentId: id, assetId: id })),
});

export type SecurityFixture = z.infer<typeof securityFixtureSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type Device = z.infer<typeof deviceSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Privilege = z.infer<typeof privilegeSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Incident = z.infer<typeof incidentSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Vulnerability = z.infer<typeof vulnerabilitySchema>;
export type SecurityEvent = z.infer<typeof securityEventSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;

export interface IncidentContext {
  lifecycle: SecurityCase; incident: Incident; identity: Identity | null; devices: Device[]; sessions: Session[];
  privileges: Privilege[]; assets: Asset[]; events: SecurityEvent[]; evidence: Evidence[];
}
export interface FindingContext {
  lifecycle: SecurityCase; finding: Finding; vulnerability: Vulnerability; asset: Asset; events: SecurityEvent[]; evidence: Evidence[];
}

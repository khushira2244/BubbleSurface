import type { SecurityCase } from "../lifecycle/lifecycle.types";
import type { Asset, Device, Evidence, Finding, Identity, Incident, Privilege, SecurityEvent, Session, Vulnerability } from "./security.schemas";

export interface SecurityContextRepository {
  getCase(id: string): SecurityCase | null;
  getIncident(id: string): Incident | null;
  getFinding(id: string): Finding | null;
  getIdentity(id: string): Identity | null;
  getDevice(id: string): Device | null;
  getActiveSessions(identityId: string): Session[];
  getDevicesForIdentity(identityId: string): Device[];
  getPrivilegesForIdentity(identityId: string): Privilege[];
  getAssetsForIncident(incidentId: string): Asset[];
  getAsset(id: string): Asset | null;
  getVulnerabilityForFinding(findingId: string): Vulnerability | null;
  getEvidenceForSubject(subjectType: "INCIDENT" | "FINDING", subjectId: string): Evidence[];
  getSecurityEventsForSubject(subjectType: "INCIDENT" | "FINDING", subjectId: string): SecurityEvent[];
}

import type { Evidence, Identity, Privilege, SecurityEvent, Session } from "../domain/security/security.schemas";

export interface EventSearchQuery {
  subjectType?: "INCIDENT" | "FINDING";
  subjectId?: string;
  identityId?: string;
  from?: string;
  to?: string;
  limit?: number;
}
export interface EvidenceTimeline { events: SecurityEvent[]; evidence: Evidence[] }

export interface SecurityEventSource {
  searchEvents(query: EventSearchQuery): SecurityEvent[];
  getEventsForIdentity(identityId: string): SecurityEvent[];
  getEvidenceTimeline(subjectType: "INCIDENT" | "FINDING", subjectId: string): EvidenceTimeline;
  getEventsForIncident(incidentId: string): SecurityEvent[];
}

export interface IdentityState {
  identity: Identity;
  sessions: Session[];
  privileges: Privilege[];
}
export interface IdentityProvider {
  getIdentity(identityId: string): Identity | null;
  getGroupsOrPrivileges(identityId: string): Privilege[];
  getActiveSessions(identityId: string): Session[];
  getIdentityState(identityId: string): IdentityState | null;
  revokeSession?(sessionId: string, idempotencyKey: string): Promise<unknown>;
  removePrivilege?(privilegeId: string, idempotencyKey: string): Promise<unknown>;
}

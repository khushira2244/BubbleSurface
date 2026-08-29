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
export type MaybePromise<T> = T | Promise<T>;

export interface SecurityEventSource {
  indexSecurityEvent?(event: SecurityEvent): Promise<void>;
  searchEvents(query: EventSearchQuery): MaybePromise<SecurityEvent[]>;
  getEventsForIdentity(identityId: string): MaybePromise<SecurityEvent[]>;
  getEvidenceTimeline(subjectType: "INCIDENT" | "FINDING", subjectId: string): MaybePromise<EvidenceTimeline>;
  getEventsForIncident(incidentId: string): MaybePromise<SecurityEvent[]>;
}

export interface IdentityState {
  identity: Identity;
  sessions: Session[];
  privileges: Privilege[];
}
export interface IdentityProvider {
  readonly provider?: "demo" | "auth0";
  getIdentity(identityId: string): MaybePromise<Identity | null>;
  getGroupsOrPrivileges(identityId: string): MaybePromise<Privilege[]>;
  getActiveSessions(identityId: string): MaybePromise<Session[]>;
  getIdentityState(identityId: string): MaybePromise<IdentityState | null>;
  revokeSession?(sessionId: string, idempotencyKey: string): Promise<unknown>;
  removePrivilege?(privilegeId: string, idempotencyKey: string): Promise<unknown>;
}

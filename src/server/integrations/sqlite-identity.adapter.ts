import type { SecurityContextRepository } from "../domain/security/security.repository";
import type { IdentityProvider } from "./security-ports";

export class SqliteIdentityAdapter implements IdentityProvider {
  readonly provider = "demo" as const;
  constructor(private readonly repository: SecurityContextRepository) {}
  getIdentity(identityId: string) { return this.repository.getIdentity(identityId); }
  getGroupsOrPrivileges(identityId: string) { return this.repository.getPrivilegesForIdentity(identityId); }
  getActiveSessions(identityId: string) { return this.repository.getActiveSessions(identityId); }
  getIdentityState(identityId: string) {
    const identity = this.getIdentity(identityId);
    return identity ? { identity, sessions: this.getActiveSessions(identityId), privileges: this.getGroupsOrPrivileges(identityId) } : null;
  }
}

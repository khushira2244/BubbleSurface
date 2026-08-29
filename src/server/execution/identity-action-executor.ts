export interface IdentityActionExecutor {
  providerFor?(actionType:"REVOKE_SESSIONS"|"REMOVE_PRIVILEGE"):string;
  revokeSessions(sessionIds:string[]):Promise<Record<string,unknown>>;
  removePrivileges(privilegeIds:string[]):Promise<Record<string,unknown>>;
}

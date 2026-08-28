export interface IdentityActionExecutor {
  revokeSessions(sessionIds:string[]):Promise<Record<string,unknown>>;
  removePrivileges(privilegeIds:string[]):Promise<Record<string,unknown>>;
}

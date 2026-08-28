import type Database from "better-sqlite3";
import type { IdentityActionExecutor } from "./identity-action-executor";
export class DemoIdentityActionExecutor implements IdentityActionExecutor {
  constructor(private readonly db:Database.Database){}
  async revokeSessions(ids:string[]){const update=this.db.prepare("UPDATE sessions SET status='REVOKED' WHERE id=? AND status='ACTIVE'");const changed=this.db.transaction(()=>ids.reduce((n,id)=>n+update.run(id).changes,0))();return {revokedSessionIds:ids,changed};}
  async removePrivileges(ids:string[]){const at=new Date().toISOString(),update=this.db.prepare("UPDATE privileges SET status='REVOKED',revoked_at=? WHERE id=? AND status='ACTIVE'");const changed=this.db.transaction(()=>ids.reduce((n,id)=>n+update.run(at,id).changes,0))();return {revokedPrivilegeIds:ids,changed};}
}

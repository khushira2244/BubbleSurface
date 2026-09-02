import type Database from "better-sqlite3";
import { seedSecurityData } from "./seed-security-data";
import { securityFixture } from "./security-fixture";

export const DEMO_SUBJECT_ID = "INC-1001";

export interface DemoResetReport {
  subjectId: string;
  lifecycleState: string;
  lifecycleVersion: number;
  proposals: number;
  approvals: number;
  executions: number;
  verifications: number;
}

export function resetDemoState(db: Database.Database, subjectId = DEMO_SUBJECT_ID): DemoResetReport {
  const seededCase = securityFixture.cases.find((item) => item.id === subjectId);
  const incident = securityFixture.incidents.find((item) => item.id === subjectId);
  if (!seededCase || !incident) throw new Error(`No deterministic demo fixture exists for ${subjectId}.`);

  // This imports and invokes the canonical seed first, restoring any missing fixture rows.
  seedSecurityData(db);
  const identityId = incident.affectedIdentityId;
  const seededIdentity = securityFixture.identities.find((item) => item.id === identityId);

  db.transaction(() => {
    const actionIds = new Set<string>();
    for (const row of db.prepare("SELECT id FROM action_proposals WHERE subject_type='INCIDENT' AND subject_id=?").all(subjectId) as Array<{id:string}>) actionIds.add(row.id);
    for (const row of db.prepare("SELECT action_id AS id FROM action_proposal_versions WHERE subject_type='INCIDENT' AND subject_id=?").all(subjectId) as Array<{id:string}>) actionIds.add(row.id);

    for (const actionId of actionIds) {
      db.prepare("DELETE FROM verification_results WHERE action_id=?").run(actionId);
      db.prepare("DELETE FROM execution_records WHERE action_id=?").run(actionId);
      db.prepare("DELETE FROM approval_decisions WHERE action_id=?").run(actionId);
    }
    db.prepare("DELETE FROM verification_results WHERE subject_type='INCIDENT' AND subject_id=?").run(subjectId);
    db.prepare("DELETE FROM action_proposal_versions WHERE subject_type='INCIDENT' AND subject_id=?").run(subjectId);
    db.prepare("DELETE FROM action_proposals WHERE subject_type='INCIDENT' AND subject_id=?").run(subjectId);
    db.prepare("DELETE FROM reasoning_runs WHERE subject_type='INCIDENT' AND subject_id=?").run(subjectId);
    db.prepare("DELETE FROM audit_events WHERE subject_type='INCIDENT' AND subject_id=?").run(subjectId);
    db.prepare("DELETE FROM lifecycle_events WHERE case_id=?").run(subjectId);
    db.prepare("UPDATE security_cases SET title=?,state=?,version=?,created_at=?,updated_at=? WHERE id=?")
      .run(seededCase.title,seededCase.state,seededCase.version,seededCase.createdAt,seededCase.updatedAt,subjectId);

    if (identityId) {
      if (!seededIdentity) throw new Error(`No deterministic identity fixture exists for ${identityId}.`);
      db.prepare("UPDATE identities SET display_name=?,email=?,department=?,normal_location=?,risk_level=?,source=?,created_at=?,updated_at=? WHERE id=?")
        .run(seededIdentity.displayName,seededIdentity.email,seededIdentity.department,seededIdentity.normalLocation,seededIdentity.riskLevel,seededIdentity.source,seededIdentity.createdAt,seededIdentity.updatedAt,seededIdentity.id);
      const updateSession=db.prepare("UPDATE sessions SET identity_id=?,device_id=?,token_type=?,status=?,ip_address=?,location=?,created_at=?,last_seen_at=?,source=? WHERE id=?");
      for(const item of securityFixture.sessions.filter(value=>value.identityId===identityId)) updateSession.run(item.identityId,item.deviceId,item.tokenType,item.status,item.ipAddress,item.location,item.createdAt,item.lastSeenAt,item.source,item.id);
      const updatePrivilege=db.prepare("UPDATE privileges SET identity_id=?,asset_id=?,name=?,scope=?,status=?,granted_at=?,revoked_at=?,source=? WHERE id=?");
      for(const item of securityFixture.privileges.filter(value=>value.identityId===identityId)) updatePrivilege.run(item.identityId,item.assetId,item.name,item.scope,item.status,item.grantedAt,item.revokedAt,item.source,item.id);
    }
  })();

  const lifecycle=db.prepare("SELECT state,version FROM security_cases WHERE id=?").get(subjectId) as {state:string;version:number};
  const proposals=Number((db.prepare("SELECT COUNT(*) AS count FROM action_proposal_versions WHERE subject_type='INCIDENT' AND subject_id=?").get(subjectId) as {count:number}).count);
  const approvals=Number((db.prepare("SELECT COUNT(*) AS count FROM approval_decisions WHERE action_id IN (SELECT id FROM action_proposals WHERE subject_type='INCIDENT' AND subject_id=?)").get(subjectId) as {count:number}).count);
  const executions=Number((db.prepare("SELECT COUNT(*) AS count FROM execution_records WHERE action_id IN (SELECT id FROM action_proposals WHERE subject_type='INCIDENT' AND subject_id=?)").get(subjectId) as {count:number}).count);
  const verifications=Number((db.prepare("SELECT COUNT(*) AS count FROM verification_results WHERE subject_type='INCIDENT' AND subject_id=?").get(subjectId) as {count:number}).count);
  return {subjectId,lifecycleState:lifecycle.state,lifecycleVersion:lifecycle.version,proposals,approvals,executions,verifications};
}

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeSecuritySchema } from "../db/security-schema";
import { seedSecurityData } from "./seed-security-data";
import { resetDemoState } from "./reset-demo-state";

describe("demo reset",()=>{
  let db:Database.Database;
  beforeEach(()=>{db=new Database(":memory:");initializeSecuritySchema(db);seedSecurityData(db);});
  afterEach(()=>db.close());

  it("replays INC-1001 deterministically without touching unrelated subjects",()=>{
    db.prepare("UPDATE security_cases SET state='RECOVERED',version=10 WHERE id='INC-1001'").run();
    db.prepare("UPDATE sessions SET status='REVOKED' WHERE id='SES-ASHA-SUSPICIOUS'").run();
    db.prepare("UPDATE privileges SET status='REVOKED',revoked_at='2026-08-29T00:00:00.000Z' WHERE id='PRV-ASHA-FINADMIN'").run();
    db.prepare("INSERT INTO action_proposals(id,subject_type,subject_id,action_type,parameters_json,status,proposed_by,created_at,updated_at) VALUES('ACT-RESET','INCIDENT','INC-1001','REMOVE_PRIVILEGE','{}','PROPOSED','AI','2026-08-29T00:00:00.000Z','2026-08-29T00:00:00.000Z')").run();
    db.prepare("INSERT INTO action_proposal_versions(action_id,proposal_version,subject_type,subject_id,action_type,parameters_json,rationale,evidence_refs_json,status,created_by,created_at,updated_at) VALUES('ACT-RESET',1,'INCIDENT','INC-1001','REMOVE_PRIVILEGE','{}','reset','[]','PROPOSED','AI','2026-08-29T00:00:00.000Z','2026-08-29T00:00:00.000Z')").run();
    db.prepare("INSERT INTO approval_decisions(id,action_id,decision,reviewed_by,created_at,proposal_version) VALUES('APR-RESET','ACT-RESET','APPROVED','analyst','2026-08-29T00:00:00.000Z',1)").run();
    const first=resetDemoState(db),second=resetDemoState(db);
    expect(first).toEqual({subjectId:"INC-1001",lifecycleState:"INVESTIGATING",lifecycleVersion:3,proposals:0,approvals:0,executions:0,verifications:0});expect(second).toEqual(first);
    expect(db.prepare("SELECT status FROM sessions WHERE id='SES-ASHA-SUSPICIOUS'").get()).toEqual({status:"ACTIVE"});
    expect(db.prepare("SELECT status,revoked_at FROM privileges WHERE id='PRV-ASHA-FINADMIN'").get()).toEqual({status:"ACTIVE",revoked_at:null});
    expect(db.prepare("SELECT state,version FROM security_cases WHERE id='FIND-2001'").get()).toEqual({state:"INVESTIGATING",version:3});
  });
});

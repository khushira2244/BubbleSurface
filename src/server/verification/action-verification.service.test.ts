import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeSecuritySchema } from "../db/security-schema";
import { ControlPlaneService } from "../domain/control-plane/control-plane.service";
import { EvidenceReferenceValidator } from "../domain/control-plane/evidence-reference.validator";
import { LifecycleService } from "../domain/lifecycle/lifecycle.service";
import { SecurityContextService } from "../domain/security/security-context.service";
import { ActionExecutionService } from "../execution/action-execution.service";
import { DemoIdentityActionExecutor } from "../execution/demo-identity-action.executor";
import { SqliteCaseRepository } from "../repositories/sqlite-case.repository";
import { SqliteControlPlaneRepository } from "../repositories/sqlite-control-plane.repository";
import { SqliteSecurityContextRepository } from "../repositories/sqlite-security-context.repository";
import { ProposalReviewService } from "../review/proposal-review.service";
import { SqliteProposalReviewRepository } from "../review/sqlite-proposal-review.repository";
import { seedSecurityData } from "../seed/seed-security-data";
import { ActionVerificationService } from "./action-verification.service";
import { DemoIdentityVerificationSource } from "./demo-identity-verification.source";
import { StaleVerificationLifecycleError, VerificationAuthorityError, VerificationPermissionError } from "./verification.errors";
import { CapabilityContextService } from "../webmcp/capability-context.service";
import { SqliteCapabilityContextRepository } from "../webmcp/sqlite-capability-context.repository";
import { evaluateCapabilities } from "../webmcp/capability-policy";

describe("post-containment verification", () => {
  let db:Database.Database, verify:ActionVerificationService, control:ControlPlaneService;
  const base={subjectId:"INC-1001",actionId:"ACT-VERIFY",proposalVersion:1,actorId:"browser-agent"};
  beforeEach(async()=>{
    db=new Database(":memory:");initializeSecuritySchema(db);seedSecurityData(db);
    const sr=new SqliteSecurityContextRepository(db), evidence=new EvidenceReferenceValidator(sr), proposals=new SqliteProposalReviewRepository(db), lifecycle=new LifecycleService(new SqliteCaseRepository(db)), security=new SecurityContextService(sr);
    control=new ControlPlaneService(new SqliteControlPlaneRepository(db),evidence);
    control.saveActionProposal({id:base.actionId,proposalVersion:1,subjectType:"INCIDENT",subjectId:base.subjectId,actionType:"REVOKE_SESSIONS",parameters:{sessionIds:["SES-ASHA-SUSPICIOUS"],lifecycleVersion:3},rationale:"verify",evidenceRefs:["EVD-1001"],status:"PROPOSED",createdBy:"AI",createdAt:"2026-08-28T00:00:00.000Z",updatedAt:"2026-08-28T00:00:00.000Z"});
    for(const [command,version] of [["VALIDATE_CASE",3],["PREPARE_RESPONSE",4],["REQUEST_APPROVAL",5]] as const)lifecycle.execute({caseId:base.subjectId,caseType:"INCIDENT",command,expectedVersion:version,actorId:"analyst-kavya"});
    new ProposalReviewService(proposals,control,security,evidence,lifecycle).approve({actionId:base.actionId,proposalVersion:1,expectedLifecycleVersion:6,actorId:"analyst-kavya"});
    await new ActionExecutionService(proposals,control,security,lifecycle,new DemoIdentityActionExecutor(db)).execute({...base,expectedLifecycleVersion:7,idempotencyKey:"execute-verify-test",expectedActionType:"REVOKE_SESSIONS"});
    verify=new ActionVerificationService(proposals,control,security,lifecycle,new DemoIdentityVerificationSource(db));
  });
  afterEach(()=>db.close());

  it("observes containment and recovers only after both checks",async()=>{
    const first=await verify.verify({...base,expectedLifecycleVersion:8,idempotencyKey:"verify-one",kind:"VERIFY_CONTAINMENT"});
    expect(first.verification.success).toBe(true);expect(first.lifecycle.state).toBe("VERIFYING");
    const second=await verify.verify({...base,expectedLifecycleVersion:9,idempotencyKey:"verify-two",kind:"VERIFY_IDENTITY_STATE"});
    expect(second.verification.observedState.activeTrustedSessionIds).toContain("SES-ASHA-NORMAL");expect(second.lifecycle).toMatchObject({state:"RECOVERED",version:10});
  });
  it("keeps failed observations in VERIFYING and replays deterministically",async()=>{
    db.prepare("UPDATE sessions SET status='ACTIVE' WHERE id='SES-ASHA-SUSPICIOUS'").run();
    const input={...base,expectedLifecycleVersion:8,idempotencyKey:"verify-failed",kind:"VERIFY_CONTAINMENT" as const};
    const first=await verify.verify(input),retry=await verify.verify(input);
    expect(first.verification.success).toBe(false);expect(first.lifecycle.state).toBe("VERIFYING");expect(retry.duplicate).toBe(true);expect(retry.verification.id).toBe(first.verification.id);
  });
  it("blocks stale lifecycle and missing permission",async()=>{
    await expect(verify.verify({...base,expectedLifecycleVersion:7,idempotencyKey:"stale",kind:"VERIFY_CONTAINMENT"})).rejects.toBeInstanceOf(StaleVerificationLifecycleError);
    await expect(verify.verify({...base,expectedLifecycleVersion:8,idempotencyKey:"permission",kind:"VERIFY_CONTAINMENT",actorId:"unknown"})).rejects.toBeInstanceOf(VerificationPermissionError);
  });
  it("requires a successful execution",async()=>{
    db.prepare("DELETE FROM execution_records").run();
    await expect(verify.verify({...base,expectedLifecycleVersion:8,idempotencyKey:"none",kind:"VERIFY_CONTAINMENT"})).rejects.toBeInstanceOf(VerificationAuthorityError);
  });
  it("checks privilege absence for REMOVE_PRIVILEGE and recovers only after both kinds pass",async()=>{
    const parameters=JSON.stringify({privilegeIds:["PRV-ASHA-FINADMIN"],lifecycleVersion:6});
    db.prepare("UPDATE action_proposal_versions SET action_type='REMOVE_PRIVILEGE',parameters_json=? WHERE action_id=?").run(parameters,base.actionId);
    db.prepare("UPDATE action_proposals SET action_type='REMOVE_PRIVILEGE',parameters_json=? WHERE id=?").run(parameters,base.actionId);
    const failed=await verify.verify({...base,expectedLifecycleVersion:8,idempotencyKey:"privilege-active",kind:"VERIFY_IDENTITY_STATE"});
    expect(failed.verification).toMatchObject({success:false,observedState:{activeTargetIds:["PRV-ASHA-FINADMIN"]}});
    expect(failed.lifecycle.state).toBe("VERIFYING");
    db.prepare("UPDATE privileges SET status='REVOKED',revoked_at='2026-08-28T01:00:00.000Z' WHERE id='PRV-ASHA-FINADMIN'").run();
    const identity=await verify.verify({...base,expectedLifecycleVersion:9,idempotencyKey:"privilege-absent",kind:"VERIFY_IDENTITY_STATE"});
    expect(identity.verification).toMatchObject({success:true,observedState:{activeTargetIds:[]}});expect(identity.lifecycle.state).toBe("VERIFYING");
    const containment=await verify.verify({...base,expectedLifecycleVersion:9,idempotencyKey:"privilege-contained",kind:"VERIFY_CONTAINMENT"});
    expect(containment.verification.success).toBe(true);expect(containment.lifecycle).toMatchObject({state:"RECOVERED",version:10});
    const allowed=evaluateCapabilities(new CapabilityContextService(new SqliteCapabilityContextRepository(db)).load("INCIDENT","INC-1001")).allowed.map(x=>x.toolName);
    expect(allowed).not.toEqual(expect.arrayContaining(["remove_approved_privilege","revoke_approved_sessions","verify_identity_state","verify_containment"]));
  });
});

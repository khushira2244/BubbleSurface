import { randomUUID } from "node:crypto";
import type { ControlPlaneService } from "../domain/control-plane/control-plane.service";
import type { LifecycleService } from "../domain/lifecycle/lifecycle.service";
import type { SecurityContextService } from "../domain/security/security-context.service";
import { DemoAnalystResolver } from "../review/demo-analyst-resolver";
import type { SqliteProposalReviewRepository } from "../review/sqlite-proposal-review.repository";
import type { IdentityVerificationSource } from "./identity-verification-source";
import { StaleVerificationLifecycleError, VerificationAuthorityError, VerificationError, VerificationPermissionError } from "./verification.errors";

export type VerificationKind = "VERIFY_CONTAINMENT" | "VERIFY_IDENTITY_STATE";
export interface VerifyInput { subjectId:string; expectedLifecycleVersion:number; actionId:string; proposalVersion:number; idempotencyKey:string; actorId:string; kind:VerificationKind }

export class ActionVerificationService {
  constructor(private readonly proposals:SqliteProposalReviewRepository, private readonly control:ControlPlaneService, private readonly security:SecurityContextService, private readonly lifecycle:LifecycleService, private readonly source:IdentityVerificationSource, private readonly analysts=new DemoAnalystResolver()) {}

  async verify(input:VerifyInput) {
    const prior=this.control.getVerificationByIdempotencyKey(input.idempotencyKey);
    if(prior){if(prior.actionId===input.actionId&&prior.proposalVersion===input.proposalVersion&&prior.verificationType===input.kind)return{verification:prior,lifecycle:this.security.getIncident(input.subjectId).lifecycle,duplicate:true};throw new VerificationError("VERIFICATION_IDEMPOTENCY_CONFLICT","Verification idempotency key was reused incompatibly.");}
    const verificationId=randomUUID();
    try {
      if(!this.analysts.resolve(input.actorId).permissions.includes("VERIFY"))throw new VerificationPermissionError();
      let context=this.security.getIncidentContext(input.subjectId);
      if(!["CONTAINED","VERIFYING"].includes(context.lifecycle.state)||context.lifecycle.version!==input.expectedLifecycleVersion)throw new StaleVerificationLifecycleError();
      const proposal=this.proposals.latest(input.actionId);
      if(!proposal||proposal.subjectId!==input.subjectId||proposal.proposalVersion!==input.proposalVersion)throw new VerificationAuthorityError("The proposal is stale or unrelated.");
      if(!this.proposals.findDecision(input.actionId,input.proposalVersion,"APPROVED"))throw new VerificationAuthorityError("The exact proposal is not approved.");
      const execution=this.control.listExecutionRecords(input.actionId).find(x=>x.proposalVersion===input.proposalVersion&&x.status==="SUCCEEDED");
      if(!execution)throw new VerificationAuthorityError("A successful exact execution is required.");
      this.audit("VERIFICATION_REQUESTED",input,execution.id,verificationId);
      if(context.lifecycle.state==="CONTAINED"){this.lifecycle.execute({caseId:input.subjectId,caseType:"INCIDENT",command:"START_VERIFICATION",expectedVersion:input.expectedLifecycleVersion,actorId:input.actorId});context=this.security.getIncidentContext(input.subjectId);}
      this.audit("VERIFICATION_STARTED",input,execution.id,verificationId);
      const identityId=context.identity?.id;if(!identityId)throw new VerificationAuthorityError("The affected identity no longer exists in incident context.");
      const observed=await this.source.observeIdentity(identityId);
      const targets=(proposal.actionType==="REVOKE_SESSIONS"?proposal.parameters.sessionIds:proposal.parameters.privilegeIds)as string[];
      let expected:Record<string,unknown>,state:Record<string,unknown>,success:boolean;
      if(input.kind==="VERIFY_CONTAINMENT"){
        if(proposal.actionType==="REVOKE_SESSIONS"){
          const active=observed.sessions.filter(x=>targets.includes(x.id)&&x.status==="ACTIVE").map(x=>x.id),revoked=observed.sessions.filter(x=>targets.includes(x.id)&&x.status!=="ACTIVE").map(x=>x.id);
          expected={revokedSessionIds:targets};state={activeTargetSessionIds:active,revokedTargetSessionIds:revoked};success=active.length===0&&revoked.length===targets.length;
        }else{
          const active=observed.privileges.filter(x=>targets.includes(x.id)&&x.status==="ACTIVE").map(x=>x.id),revoked=observed.privileges.filter(x=>targets.includes(x.id)&&x.status!=="ACTIVE").map(x=>x.id);
          expected={revokedPrivilegeIds:targets};state={activeTargetPrivilegeIds:active,revokedTargetPrivilegeIds:revoked};success=active.length===0&&revoked.length===targets.length;
        }
      }else{
        const activeTrusted=observed.sessions.filter(x=>x.status==="ACTIVE"&&x.deviceId&&observed.trustedDeviceIds.includes(x.deviceId)).map(x=>x.id),activeTargets=observed.sessions.filter(x=>targets.includes(x.id)&&x.status==="ACTIVE").map(x=>x.id);
        expected={identityExists:true,activeTargetIds:[],trustedSessionPreserved:true};state={identityExists:observed.identityExists,activeTargetIds:activeTargets,activeTrustedSessionIds:activeTrusted,sessions:observed.sessions,privileges:observed.privileges};success=observed.identityExists&&activeTargets.length===0&&activeTrusted.length>0;
      }
      const at=new Date().toISOString(),result={id:verificationId,subjectType:"INCIDENT"as const,subjectId:input.subjectId,actionId:input.actionId,proposalVersion:input.proposalVersion,executionId:execution.id,verificationType:input.kind,expectedState:expected,observedState:state,success,checkedAt:at,details:{status:success?"PASSED":"FAILED",lifecycleVersionAtStart:input.expectedLifecycleVersion},actorId:input.actorId,source:this.source.provider??"demo-identity",startedAt:at,failureClassification:success?null:"OBSERVED_STATE_MISMATCH",idempotencyKey:input.idempotencyKey};
      this.control.saveVerificationResult(result);if(this.source.provider==="auth0")this.audit(success?"EXTERNAL_VERIFICATION_PASSED":"EXTERNAL_VERIFICATION_FAILED",input,execution.id,verificationId);this.audit(success?"VERIFICATION_PASSED":"VERIFICATION_FAILED",input,execution.id,verificationId);
      let lifecycle=context.lifecycle;
      if(success){const both=[...this.control.listVerificationResults(input.actionId),result].filter(x=>x.proposalVersion===input.proposalVersion&&x.success);if(new Set(both.map(x=>x.verificationType)).size===2){lifecycle=this.lifecycle.execute({caseId:input.subjectId,caseType:"INCIDENT",command:"MARK_RECOVERED",expectedVersion:context.lifecycle.version,actorId:input.actorId});this.audit("INCIDENT_RECOVERED",{...input,expectedLifecycleVersion:lifecycle.version},execution.id,verificationId);}}
      return{verification:result,lifecycle,duplicate:false};
    }catch(error){if(error instanceof VerificationError)this.audit("VERIFICATION_BLOCKED",input,null,verificationId,error.message);else if(this.source.provider==="auth0")this.audit("EXTERNAL_VERIFICATION_FAILED",input,null,verificationId,typeof error==="object"&&error!==null&&"code"in error&&typeof error.code==="string"?error.code:"AUTH0_PROVIDER_FAILURE");throw error;}
  }
  private audit(type:string,input:VerifyInput,executionId:string|null,verificationId:string,reason?:string){this.control.appendAuditEvent({id:randomUUID(),subjectType:"INCIDENT",subjectId:input.subjectId,actorType:"WEBMCP",actorId:input.actorId,eventType:type,actionId:input.actionId,proposalVersion:input.proposalVersion,executionId,lifecycleVersion:input.expectedLifecycleVersion,source:"verification-orchestrator",metadata:{verificationId,provider:this.source.provider??"demo",...(reason?{reason}:{})},occurredAt:new Date().toISOString()});}
}

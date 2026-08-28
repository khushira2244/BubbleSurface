import { createHash, randomUUID } from "node:crypto";
import type { ControlPlaneService } from "../domain/control-plane/control-plane.service";
import type { EvidenceReferenceValidator } from "../domain/control-plane/evidence-reference.validator";
import type { LifecycleService } from "../domain/lifecycle/lifecycle.service";
import type { SecurityContextService } from "../domain/security/security-context.service";
import type { ActionProposal, ApprovalDecision } from "../domain/control-plane/control-plane.schemas";
import { DemoAnalystResolver } from "./demo-analyst-resolver";
import { ProposalNotFoundError, ProposalReviewBlockedError, ReviewPermissionDeniedError,
  StaleProposalVersionError, StaleReviewLifecycleError } from "./proposal-review.errors";
import type { SqliteProposalReviewRepository } from "./sqlite-proposal-review.repository";

export class ProposalReviewService {
  constructor(private readonly repo: SqliteProposalReviewRepository, private readonly control: ControlPlaneService,
    private readonly security: SecurityContextService, private readonly evidence: EvidenceReferenceValidator,
    private readonly lifecycle: LifecycleService, private readonly analysts = new DemoAnalystResolver()) {}
  list(subjectId:string) { const versions=this.repo.list(subjectId); return { subjectId, actions:[...new Set(versions.map(x=>x.id))].map(id=>this.read(id)) }; }
  read(actionId:string) { const versions=this.repo.versions(actionId); if(!versions.length) throw new ProposalNotFoundError(); const decisions=this.repo.decisions(actionId);const detailed=versions.map(value=>{const exact=decisions.filter(decision=>decision.proposalVersion===value.proposalVersion).at(-1);const approvalState=exact?.decision??"NONE";return {...value,lifecycleVersion:Number(value.parameters.lifecycleVersion),proposalState:value.status,approvalState,reviewState:value.status==="SUPERSEDED"?"SUPERSEDED":approvalState==="APPROVED"?"APPROVED":approvalState==="REJECTED"?"REJECTED":"PENDING_REVIEW"};});return { actionId, currentVersion:versions.at(-1)!.proposalVersion, latest:detailed.at(-1), versions:detailed, decisions }; }
  approve(input: ReviewInput) { return this.guardedDecision("APPROVED",input); }
  reject(input: ReviewInput) { return this.guardedDecision("REJECTED",input); }
  modify(input: ModifyInput) {
    this.requirePermission(input.actorId); const latest=this.requireLatest(input.actionId,input.proposalVersion);
    const current=this.requireLifecycle(latest,input.expectedLifecycleVersion); this.requireReviewable(latest);
    const parameters={...(input.parameters ?? latest.parameters),lifecycleVersion:current.lifecycle.version}; this.validateTargets(latest.actionType,parameters,current);
    const at=new Date().toISOString(); this.repo.supersede(latest.id,latest.proposalVersion,at);
    const next:ActionProposal={...latest,proposalVersion:latest.proposalVersion+1,parameters,
      rationale:input.rationale??latest.rationale,status:"PROPOSED",createdBy:input.actorId,createdAt:at,updatedAt:at};
    this.control.saveActionProposal(next); this.audit("ACTION_MODIFIED",next,input.actorId,input.comment);
    return this.read(input.actionId);
  }
  private decide(kind:"APPROVED"|"REJECTED",input:ReviewInput) {
    this.requirePermission(input.actorId); const latest=this.requireLatest(input.actionId,input.proposalVersion);
    const duplicate=this.repo.findDecision(input.actionId,input.proposalVersion,kind); if(duplicate) return { decision:duplicate, duplicate:true, proposal:this.read(input.actionId) };
    const existing=this.repo.decisions(input.actionId).filter(x=>x.proposalVersion===input.proposalVersion);
    if(existing.length)throw new ProposalReviewBlockedError("This proposal version already has a human decision.");
    const current=this.requireLifecycle(latest,input.expectedLifecycleVersion); this.requireReviewable(latest);
    this.evidence.validate(latest.subjectType,latest.subjectId,latest.evidenceRefs);
    if(current.lifecycle.state!=="AWAITING_APPROVAL") throw new ProposalReviewBlockedError("Incident must be AWAITING_APPROVAL.");
    const at=new Date().toISOString(), value:ApprovalDecision={id:`DEC-${createHash("sha256").update(`${kind}:${input.actionId}:${input.proposalVersion}:${input.actorId}`).digest("hex").slice(0,20)}`,
      actionId:input.actionId,proposalVersion:input.proposalVersion,decision:kind,actorId:input.actorId,reason:input.comment??null,decidedAt:at};
    this.audit("ACTION_PROPOSAL_REVIEWED",latest,input.actorId,input.comment);
    this.repo.saveDecision(value); this.audit(kind==="APPROVED"?"ACTION_APPROVED":"ACTION_REJECTED",latest,input.actorId,input.comment);
    let lifecycle=current.lifecycle; if(kind==="APPROVED") lifecycle=this.lifecycle.execute({caseId:latest.subjectId,caseType:"INCIDENT",command:"START_CONTAINMENT",expectedVersion:input.expectedLifecycleVersion,actorId:input.actorId});
    return {decision:value,duplicate:false,lifecycle,proposal:this.read(input.actionId)};
  }
  private guardedDecision(kind:"APPROVED"|"REJECTED",input:ReviewInput){try{return this.decide(kind,input);}catch(error){const latest=this.repo.latest(input.actionId);if(latest)this.audit("APPROVAL_BLOCKED",latest,input.actorId,error instanceof Error?error.message:undefined);throw error;}}
  private requirePermission(actorId:string){if(!this.analysts.resolve(actorId).permissions.includes("APPROVE"))throw new ReviewPermissionDeniedError();}
  private requireLatest(id:string,v:number){const latest=this.repo.latest(id);if(!latest)throw new ProposalNotFoundError();if(latest.proposalVersion!==v)throw new StaleProposalVersionError();return latest;}
  private requireLifecycle(p:ActionProposal,v:number){const c=this.security.getIncidentContext(p.subjectId);if(c.lifecycle.version!==v)throw new StaleReviewLifecycleError();return c;}
  private requireReviewable(p:ActionProposal){if(p.status!=="PROPOSED"||this.repo.executionExists(p.id,p.proposalVersion))throw new ProposalReviewBlockedError("Proposal is superseded, rejected, or already executed.");}
  private validateTargets(type:string,p:Record<string,unknown>,c:ReturnType<SecurityContextService["getIncidentContext"]>){const ids=type==="REVOKE_SESSIONS"?p.sessionIds:p.privilegeIds;if(!Array.isArray(ids)||!ids.length)throw new ProposalReviewBlockedError("Modified targets are required.");const allowed=new Set((type==="REVOKE_SESSIONS"?c.sessions:c.privileges).map(x=>x.id));if(ids.some(x=>typeof x!=="string"||!allowed.has(x)))throw new ProposalReviewBlockedError("Modified targets must belong to the incident.");}
  private audit(type:string,p:ActionProposal,actorId:string,comment?:string){this.control.appendAuditEvent({id:randomUUID(),subjectType:p.subjectType,subjectId:p.subjectId,actorType:"HUMAN",actorId,eventType:type,actionId:p.id,proposalVersion:p.proposalVersion,executionId:null,lifecycleVersion:this.security.getIncident(p.subjectId).lifecycle.version,source:"proposal-review",metadata:{...(comment?{comment}:{})},occurredAt:new Date().toISOString()});}
}
export interface ReviewInput {actionId:string;proposalVersion:number;expectedLifecycleVersion:number;actorId:string;comment?:string}
export interface ModifyInput extends ReviewInput {parameters?:Record<string,unknown>;rationale?:string}

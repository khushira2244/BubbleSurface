import { createHash, randomUUID } from "node:crypto";
import type { ControlPlaneService } from "../domain/control-plane/control-plane.service";
import type { LifecycleService } from "../domain/lifecycle/lifecycle.service";
import type { SecurityContextService } from "../domain/security/security-context.service";

export interface PrepareContainmentInput {
  subjectId: string; expectedLifecycleVersion: number;
  requestedActions: Array<"REVOKE_SESSIONS" | "REMOVE_PRIVILEGE">; evidenceRefs: string[];
}
export class InvestigationCompletionService {
  constructor(private readonly security: SecurityContextService, private readonly lifecycle: LifecycleService,
    private readonly control: ControlPlaneService) {}
  complete(subjectId: string, expectedLifecycleVersion: number, actorId: string) {
    const current = this.security.getIncident(subjectId).lifecycle;
    if (current.state !== "INVESTIGATING") return current;
    const next = this.lifecycle.execute({caseId: subjectId, caseType: "INCIDENT", command: "VALIDATE_CASE",
      expectedVersion: expectedLifecycleVersion, actorId});
    this.control.appendAuditEvent({id:randomUUID(),subjectType:"INCIDENT",subjectId,actorType:"WEBMCP",actorId,
      eventType:"INVESTIGATION_VALIDATED",actionId:null,proposalVersion:null,executionId:null,lifecycleVersion:next.version,
      source:"containment-preparation",metadata:{completionTool:"review_evidence_timeline"},occurredAt:new Date().toISOString()});
    return next;
  }
}
export class ContainmentPreparationService {
  constructor(private readonly security: SecurityContextService, private readonly lifecycle: LifecycleService,
    private readonly control: ControlPlaneService) {}
  prepare(input: PrepareContainmentInput, actorId: string) {
    const context = this.security.getIncidentContext(input.subjectId);
    if (context.lifecycle.state !== "VALIDATED" || context.lifecycle.version !== input.expectedLifecycleVersion)
      throw new Error("Containment preparation requires the exact current VALIDATED incident version.");
    const targets = input.requestedActions.map(actionType => ({actionType, parameters:this.parameters(actionType,context)}));
    const prepared = this.lifecycle.execute({caseId:input.subjectId,caseType:"INCIDENT",command:"PREPARE_RESPONSE",
      expectedVersion:input.expectedLifecycleVersion,actorId});
    const awaiting = this.lifecycle.execute({caseId:input.subjectId,caseType:"INCIDENT",command:"REQUEST_APPROVAL",
      expectedVersion:prepared.version,actorId});
    const at = new Date().toISOString();
    const proposals = targets.map(({actionType,parameters}) => {
      const signature=JSON.stringify({subjectId:input.subjectId,fromVersion:input.expectedLifecycleVersion,actionType,parameters,evidenceRefs:input.evidenceRefs});
      const id=`ACT-WEBMCP-${createHash("sha256").update(signature).digest("hex").slice(0,16)}`;
      const proposal={id,subjectType:"INCIDENT" as const,subjectId:input.subjectId,actionType,
        parameters:{...parameters,lifecycleVersion:awaiting.version},
        rationale:actionType==="REMOVE_PRIVILEGE"?"Remove the elevated finance privilege associated with the observed unauthorized privilege change.":"Revoke the suspicious active identity sessions associated with the incident.",
        evidenceRefs:input.evidenceRefs,proposalVersion:1,status:"PROPOSED" as const,createdBy:actorId,createdAt:at,updatedAt:at};
      this.control.saveActionProposal(proposal);
      this.control.appendAuditEvent({id:randomUUID(),subjectType:"INCIDENT",subjectId:input.subjectId,actorType:"WEBMCP",actorId,
        eventType:"ACTION_PROPOSAL_CREATED",actionId:id,proposalVersion:1,executionId:null,lifecycleVersion:awaiting.version,
        source:"containment-preparation",metadata:{actionType,parameters},occurredAt:at});
      return proposal;
    });
    this.control.appendAuditEvent({id:randomUUID(),subjectType:"INCIDENT",subjectId:input.subjectId,actorType:"SYSTEM",actorId:null,
      eventType:"HUMAN_REVIEW_REQUIRED",actionId:proposals[0]?.id??null,proposalVersion:1,executionId:null,lifecycleVersion:awaiting.version,
      source:"containment-preparation",metadata:{proposalCount:proposals.length},occurredAt:at});
    return {status:"REVIEW_REQUIRED" as const,subjectId:input.subjectId,state:awaiting.state,lifecycleVersion:awaiting.version,
      proposals:proposals.map(p=>({actionId:p.id,proposalVersion:p.proposalVersion,actionType:p.actionType,target:p.parameters,reviewRequired:true}))};
  }
  private parameters(actionType:"REVOKE_SESSIONS"|"REMOVE_PRIVILEGE", context:ReturnType<SecurityContextService["getIncidentContext"]>) {
    if(actionType==="REMOVE_PRIVILEGE") {
      const privilegeIds=context.privileges.filter(p=>p.status==="ACTIVE"&&Boolean(p.assetId)).map(p=>p.id);
      if(!privilegeIds.length) throw new Error("No active incident-related elevated privilege can be proposed for removal.");
      return {identityId:context.identity?.id,privilegeIds};
    }
    const sessionIds=context.sessions.filter(s=>s.status==="ACTIVE"&&(s.location!==context.identity?.normalLocation||s.tokenType.includes("REFRESH"))).map(s=>s.id);
    if(!sessionIds.length) throw new Error("No suspicious active incident-related session can be proposed for revocation.");
    return {identityId:context.identity?.id,sessionIds};
  }
}

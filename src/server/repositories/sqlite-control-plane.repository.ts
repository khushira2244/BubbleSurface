import type Database from "better-sqlite3";
import { actionProposalSchema, executionRecordSchema, reasoningRunSchema, type ActionProposal, type ApprovalDecision, type AuditEvent, type ExecutionRecord, type ReasoningRun, type VerificationResult } from "../domain/control-plane/control-plane.schemas";
import type { ControlPlaneRepository } from "../domain/control-plane/control-plane.repository";

export class SqliteControlPlaneRepository implements ControlPlaneRepository {
  constructor(private readonly db: Database.Database) {}
  saveActionProposal(x: ActionProposal): void {
    this.db.transaction(() => {
      this.db.prepare(`INSERT INTO action_proposal_versions
        (action_id,proposal_version,subject_type,subject_id,action_type,parameters_json,rationale,evidence_refs_json,status,created_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(x.id, x.proposalVersion, x.subjectType, x.subjectId, x.actionType,
          JSON.stringify(x.parameters), x.rationale, JSON.stringify(x.evidenceRefs), x.status, x.createdBy, x.createdAt, x.updatedAt);
      this.db.prepare(`INSERT INTO action_proposals
        (id,subject_type,subject_id,action_type,parameters_json,status,proposed_by,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET parameters_json=excluded.parameters_json,
        status=excluded.status, updated_at=excluded.updated_at`).run(x.id, x.subjectType, x.subjectId,
          x.actionType, JSON.stringify(x.parameters), x.status, x.createdBy, x.createdAt, x.updatedAt);
    })();
  }
  getActionProposal(actionId: string, proposalVersion: number): ActionProposal | null {
    const r = this.db.prepare("SELECT * FROM action_proposal_versions WHERE action_id = ? AND proposal_version = ?").get(actionId, proposalVersion) as Record<string, unknown> | undefined;
    return r ? actionProposalSchema.parse({ id: r.action_id, proposalVersion: r.proposal_version,
      subjectType: r.subject_type, subjectId: r.subject_id, actionType: r.action_type,
      parameters: JSON.parse(String(r.parameters_json)), rationale: r.rationale,
      evidenceRefs: JSON.parse(String(r.evidence_refs_json)), status: r.status,
      createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at }) : null;
  }
  saveApprovalDecision(x: ApprovalDecision): void {
    this.db.prepare("INSERT INTO approval_decisions (id,action_id,proposal_version,decision,reviewed_by,reason,created_at) VALUES (?,?,?,?,?,?,?)")
      .run(x.id, x.actionId, x.proposalVersion, x.decision, x.actorId, x.reason, x.decidedAt);
  }
  saveExecutionRecord(x: ExecutionRecord): ExecutionRecord {
    return this.db.transaction(() => {
      const existing = this.getExecutionRecordByIdempotencyKey(x.idempotencyKey);
      if (existing) return existing;
      this.db.prepare(`INSERT INTO execution_records
        (id,action_id,proposal_version,target_identifier,request_parameters_json,idempotency_key,status,result_json,started_at,completed_at,error_json,external_adapter)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(x.id, x.actionId, x.proposalVersion, x.targetIdentifier,
          JSON.stringify(x.requestParameters), x.idempotencyKey, x.status, null, x.startedAt, x.completedAt,
          x.error ? JSON.stringify(x.error) : null, x.externalAdapter);
      return x;
    })();
  }
  getExecutionRecordByIdempotencyKey(idempotencyKey: string): ExecutionRecord | null {
    const r = this.db.prepare("SELECT * FROM execution_records WHERE idempotency_key = ?").get(idempotencyKey) as Record<string, unknown> | undefined;
    return r ? executionRecordSchema.parse({ id: r.id, actionId: r.action_id, proposalVersion: r.proposal_version,
      targetIdentifier: r.target_identifier, requestParameters: JSON.parse(String(r.request_parameters_json)),
      idempotencyKey: r.idempotency_key, status: r.status, startedAt: r.started_at, completedAt: r.completed_at,
      error: r.error_json ? JSON.parse(String(r.error_json)) : null,
      ...(r.result_json ? { result: JSON.parse(String(r.result_json)) } : {}), externalAdapter: r.external_adapter }) : null;
  }
  updateExecutionRecord(x: ExecutionRecord): ExecutionRecord {
    this.db.prepare("UPDATE execution_records SET status=?,result_json=?,started_at=?,completed_at=?,error_json=?,external_adapter=? WHERE id=?")
      .run(x.status,x.result?JSON.stringify(x.result):null,x.startedAt,x.completedAt,x.error?JSON.stringify(x.error):null,x.externalAdapter,x.id);return x;
  }
  listExecutionRecords(actionId: string): ExecutionRecord[] { return (this.db.prepare("SELECT * FROM execution_records WHERE action_id=? ORDER BY COALESCE(started_at,'')").all(actionId) as Record<string,unknown>[]).map(r=>this.mapExecution(r)); }
  getExecutionRecord(id:string):ExecutionRecord|null {const r=this.db.prepare("SELECT * FROM execution_records WHERE id=?").get(id) as Record<string,unknown>|undefined;return r?this.mapExecution(r):null;}
  private mapExecution(r:Record<string,unknown>):ExecutionRecord{return executionRecordSchema.parse({id:r.id,actionId:r.action_id,proposalVersion:r.proposal_version,targetIdentifier:r.target_identifier,requestParameters:JSON.parse(String(r.request_parameters_json)),idempotencyKey:r.idempotency_key,status:r.status,startedAt:r.started_at,completedAt:r.completed_at,error:r.error_json?JSON.parse(String(r.error_json)):null,...(r.result_json?{result:JSON.parse(String(r.result_json))}:{}),externalAdapter:r.external_adapter});}
  saveVerificationResult(x: VerificationResult): void {
    this.db.prepare(`INSERT INTO verification_results
      (id,subject_type,subject_id,action_id,status,observations_json,observed_at,verification_type,expected_state_json,observed_state_json,success,proposal_version,execution_id,actor_id,source,started_at,failure_classification,idempotency_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(x.id, x.subjectType, x.subjectId, x.actionId,
        x.success ? "SUCCEEDED" : "FAILED", JSON.stringify(x.details), x.checkedAt, x.verificationType,
        JSON.stringify(x.expectedState), JSON.stringify(x.observedState), x.success ? 1 : 0,x.proposalVersion??1,
        x.executionId??null,x.actorId??null,x.source??"unknown",x.startedAt??x.checkedAt,x.failureClassification??null,x.idempotencyKey??null);
  }
  listVerificationResults(actionId:string):VerificationResult[]{return(this.db.prepare("SELECT * FROM verification_results WHERE action_id=? ORDER BY observed_at").all(actionId)as Record<string,unknown>[]).map(r=>this.mapVerification(r));}
  getVerificationResult(id:string):VerificationResult|null{const r=this.db.prepare("SELECT * FROM verification_results WHERE id=?").get(id)as Record<string,unknown>|undefined;return r?this.mapVerification(r):null;}
  getVerificationByIdempotencyKey(key:string):VerificationResult|null{const r=this.db.prepare("SELECT * FROM verification_results WHERE idempotency_key=?").get(key)as Record<string,unknown>|undefined;return r?this.mapVerification(r):null;}
  private mapVerification(r:Record<string,unknown>):VerificationResult{return {id:String(r.id),subjectType:r.subject_type as "INCIDENT"|"FINDING",subjectId:String(r.subject_id),actionId:String(r.action_id),proposalVersion:Number(r.proposal_version),executionId:r.execution_id?String(r.execution_id):null,verificationType:String(r.verification_type),expectedState:JSON.parse(String(r.expected_state_json)),observedState:JSON.parse(String(r.observed_state_json)),success:Boolean(r.success),checkedAt:String(r.observed_at),details:JSON.parse(String(r.observations_json)),actorId:r.actor_id?String(r.actor_id):undefined,source:String(r.source),startedAt:String(r.started_at),failureClassification:r.failure_classification?String(r.failure_classification):null,idempotencyKey:r.idempotency_key?String(r.idempotency_key):undefined};}
  saveReasoningRun(x: ReasoningRun): void {
    this.db.prepare(`INSERT INTO reasoning_runs
      (id,subject_type,subject_id,status,input_hash,output_json,model,created_at,completed_at,lifecycle_version,prompt_version,latency_ms,usage_json,failure_classification)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(x.id, x.subjectType, x.subjectId, x.status, x.inputHash,
        x.output ? JSON.stringify(x.output) : null, x.model, x.createdAt, x.completedAt, x.lifecycleVersion,
        x.promptVersion, x.latencyMs, x.usage ? JSON.stringify(x.usage) : null, x.failureClassification);
  }
  getReasoningRun(id: string): ReasoningRun | null {
    const r = this.db.prepare("SELECT * FROM reasoning_runs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return r ? reasoningRunSchema.parse({ id: r.id, subjectType: r.subject_type, subjectId: r.subject_id,
      status: r.status, inputHash: r.input_hash, output: r.output_json ? JSON.parse(String(r.output_json)) : null,
      model: r.model, lifecycleVersion: r.lifecycle_version, promptVersion: r.prompt_version,
      latencyMs: r.latency_ms, usage: r.usage_json ? JSON.parse(String(r.usage_json)) : null,
      failureClassification: r.failure_classification, createdAt: r.created_at, completedAt: r.completed_at }) : null;
  }
  appendAuditEvent(x: AuditEvent): void {
    this.db.prepare(`INSERT INTO audit_events
      (id,subject_type,subject_id,actor_type,actor_id,event_type,source,details_json,occurred_at,action_id,proposal_version,execution_id,lifecycle_version)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(x.id, x.subjectType, x.subjectId, x.actorType, x.actorId,
        x.eventType, x.source, JSON.stringify(x.metadata), x.occurredAt, x.actionId, x.proposalVersion, x.executionId, x.lifecycleVersion);
  }
}

import type Database from "better-sqlite3";
import { actionProposalSchema, approvalDecisionSchema, type ActionProposal, type ApprovalDecision } from "../domain/control-plane/control-plane.schemas";

type Row = Record<string, unknown>;
const proposal = (r: Row): ActionProposal => actionProposalSchema.parse({ id: r.action_id,
  proposalVersion: r.proposal_version, subjectType: r.subject_type, subjectId: r.subject_id,
  actionType: r.action_type, parameters: JSON.parse(String(r.parameters_json)), rationale: r.rationale,
  evidenceRefs: JSON.parse(String(r.evidence_refs_json)), status: r.status, createdBy: r.created_by,
  createdAt: r.created_at, updatedAt: r.updated_at });
const decision = (r: Row): ApprovalDecision => approvalDecisionSchema.parse({ id: r.id, actionId: r.action_id,
  proposalVersion: r.proposal_version, decision: r.decision, actorId: r.reviewed_by,
  reason: r.reason, decidedAt: r.created_at });

export class SqliteProposalReviewRepository {
  constructor(private readonly db: Database.Database) {}
  versions(actionId: string) { return (this.db.prepare("SELECT * FROM action_proposal_versions WHERE action_id=? ORDER BY proposal_version").all(actionId) as Row[]).map(proposal); }
  list(subjectId: string) { return (this.db.prepare("SELECT * FROM action_proposal_versions WHERE subject_type='INCIDENT' AND subject_id=? ORDER BY action_id,proposal_version").all(subjectId) as Row[]).map(proposal); }
  decisions(actionId: string) { return (this.db.prepare("SELECT * FROM approval_decisions WHERE action_id=? ORDER BY created_at").all(actionId) as Row[]).map(decision); }
  latest(actionId: string) { const rows = this.versions(actionId); return rows.at(-1) ?? null; }
  executionExists(actionId: string, version: number) { return Boolean(this.db.prepare("SELECT 1 FROM execution_records WHERE action_id=? AND proposal_version=?").get(actionId, version)); }
  saveDecision(value: ApprovalDecision) { this.db.prepare("INSERT INTO approval_decisions (id,action_id,proposal_version,decision,reviewed_by,reason,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(value.id,value.actionId,value.proposalVersion,value.decision,value.actorId,value.reason,value.decidedAt); }
  findDecision(actionId: string, version: number, kind: string) { const r=this.db.prepare("SELECT * FROM approval_decisions WHERE action_id=? AND proposal_version=? AND decision=? ORDER BY created_at LIMIT 1").get(actionId,version,kind) as Row|undefined; return r?decision(r):null; }
  supersede(actionId: string, version: number, at: string) { this.db.prepare("UPDATE action_proposal_versions SET status='SUPERSEDED',updated_at=? WHERE action_id=? AND proposal_version=?").run(at,actionId,version); }
}

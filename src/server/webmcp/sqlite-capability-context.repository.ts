import type Database from "better-sqlite3";
import { capabilityContextSchema, type CapabilityContext } from "./capability.types";
import type { CapabilityContextRepository } from "./capability-context.repository";

type Row = Record<string, unknown>;
export class SqliteCapabilityContextRepository implements CapabilityContextRepository {
  constructor(private readonly db: Database.Database,
    private readonly permissions: CapabilityContext["analystPermissions"] = ["INVESTIGATE", "PREPARE", "APPROVE", "EXECUTE", "VERIFY"]) {}

  derive(subjectType: "INCIDENT" | "FINDING", subjectId: string): CapabilityContext | null {
    const domainTable = subjectType === "INCIDENT" ? "incidents" : "findings";
    const domain = this.db.prepare(`SELECT * FROM ${domainTable} WHERE id = ?`).get(subjectId) as Row | undefined;
    const lifecycle = this.db.prepare("SELECT * FROM security_cases WHERE id = ?").get(subjectId) as Row | undefined;
    if (!domain || !lifecycle) return null;
    const proposal = this.db.prepare("SELECT * FROM action_proposal_versions WHERE subject_type = ? AND subject_id = ? ORDER BY proposal_version DESC LIMIT 1")
      .get(subjectType, subjectId) as Row | undefined;
    const approval = proposal ? this.db.prepare("SELECT * FROM approval_decisions WHERE action_id = ? AND proposal_version = ? ORDER BY created_at DESC LIMIT 1")
      .get(proposal.action_id, proposal.proposal_version) as Row | undefined : undefined;
    const execution = proposal ? this.db.prepare("SELECT * FROM execution_records WHERE action_id = ? AND proposal_version = ? ORDER BY COALESCE(started_at, '') DESC LIMIT 1")
      .get(proposal.action_id, proposal.proposal_version) as Row | undefined : undefined;
    const verification = proposal ? this.db.prepare("SELECT * FROM verification_results WHERE action_id = ? ORDER BY observed_at DESC LIMIT 1")
      .get(proposal.action_id) as Row | undefined : undefined;
    const authorityRows = this.db.prepare(`
      SELECT p.*,
        (SELECT decision FROM approval_decisions a WHERE a.action_id = p.action_id AND a.proposal_version = p.proposal_version ORDER BY created_at DESC LIMIT 1) AS approval_state,
        (SELECT status FROM execution_records e WHERE e.action_id = p.action_id AND e.proposal_version = p.proposal_version ORDER BY COALESCE(started_at, '') DESC LIMIT 1) AS execution_state
      FROM action_proposal_versions p
      WHERE p.subject_type = ? AND p.subject_id = ?
        AND p.proposal_version = (SELECT MAX(p2.proposal_version) FROM action_proposal_versions p2 WHERE p2.action_id = p.action_id)
      ORDER BY p.action_id
    `).all(subjectType, subjectId) as Row[];
    const evidenceCount = (this.db.prepare("SELECT COUNT(*) AS count FROM evidence WHERE subject_type = ? AND subject_id = ?")
      .get(subjectType, subjectId) as { count: number }).count;
    return capabilityContextSchema.parse({
      subjectType, subjectId, lifecycleState: lifecycle.state, lifecycleVersion: lifecycle.version,
      incidentOrFindingType: subjectType === "INCIDENT" ? domain.category : "VULNERABILITY_REMEDIATION",
      evidenceState: evidenceCount === 0 ? "NONE" : evidenceCount < 2 ? "PARTIAL" : "SUFFICIENT",
      analystPermissions: this.permissions,
      proposalState: proposal?.status ?? "NONE", proposalActionId: proposal?.action_id ?? null,
      proposalActionType: proposal?.action_type ?? null, proposalVersion: proposal?.proposal_version ?? null,
      approvalState: approval?.decision ?? "NONE", executionState: execution?.status ?? "NONE",
      verificationState: verification ? (Number(verification.success) ? "SUCCEEDED" : "FAILED") : "NONE",
      targetRiskLevel: domain.severity ?? null,
      proposalAuthorities: authorityRows.map((row) => ({ actionId: row.action_id, actionType: row.action_type,
        proposalVersion: row.proposal_version, proposalState: row.status,
        approvalState: row.approval_state ?? "NONE", executionState: row.execution_state ?? "NONE" })),
    });
  }
}

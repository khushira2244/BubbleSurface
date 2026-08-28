import type Database from "better-sqlite3";

export function initializeSecuritySchema(db: Database.Database): void {
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_cases (id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('INCIDENT', 'VULNERABILITY_FINDING')), title TEXT NOT NULL, state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lifecycle_events (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, case_type TEXT NOT NULL, command TEXT NOT NULL, from_state TEXT NOT NULL, to_state TEXT NOT NULL, from_version INTEGER NOT NULL, to_version INTEGER NOT NULL, actor_id TEXT NOT NULL, occurred_at TEXT NOT NULL, FOREIGN KEY (case_id) REFERENCES security_cases(id));
    CREATE INDEX IF NOT EXISTS idx_lifecycle_events_case_id ON lifecycle_events(case_id, occurred_at);
    CREATE TABLE IF NOT EXISTS identities (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, department TEXT NOT NULL, normal_location TEXT NOT NULL, risk_level TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, identity_id TEXT NOT NULL, hostname TEXT NOT NULL, platform TEXT NOT NULL, trust_status TEXT NOT NULL, location TEXT NOT NULL, source TEXT NOT NULL, last_seen_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (identity_id) REFERENCES identities(id));
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, environment TEXT NOT NULL, criticality TEXT NOT NULL, component TEXT, source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, identity_id TEXT NOT NULL, device_id TEXT, token_type TEXT NOT NULL, status TEXT NOT NULL, ip_address TEXT NOT NULL, location TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, source TEXT NOT NULL, FOREIGN KEY (identity_id) REFERENCES identities(id), FOREIGN KEY (device_id) REFERENCES devices(id));
    CREATE TABLE IF NOT EXISTS privileges (id TEXT PRIMARY KEY, identity_id TEXT NOT NULL, asset_id TEXT, name TEXT NOT NULL, scope TEXT NOT NULL, status TEXT NOT NULL, granted_at TEXT NOT NULL, revoked_at TEXT, source TEXT NOT NULL, FOREIGN KEY (identity_id) REFERENCES identities(id), FOREIGN KEY (asset_id) REFERENCES assets(id));
    CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, affected_identity_id TEXT, summary TEXT NOT NULL, severity TEXT NOT NULL, category TEXT NOT NULL, owner TEXT, source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (id) REFERENCES security_cases(id), FOREIGN KEY (affected_identity_id) REFERENCES identities(id));
    CREATE TABLE IF NOT EXISTS findings (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, summary TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, component TEXT NOT NULL, owner TEXT, source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (id) REFERENCES security_cases(id), FOREIGN KEY (asset_id) REFERENCES assets(id));
    CREATE TABLE IF NOT EXISTS vulnerabilities (id TEXT PRIMARY KEY, finding_id TEXT NOT NULL, asset_id TEXT NOT NULL, title TEXT NOT NULL, cwe TEXT, endpoint TEXT, status TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (finding_id) REFERENCES findings(id), FOREIGN KEY (asset_id) REFERENCES assets(id));
    CREATE TABLE IF NOT EXISTS incident_assets (incident_id TEXT NOT NULL, asset_id TEXT NOT NULL, PRIMARY KEY (incident_id, asset_id), FOREIGN KEY (incident_id) REFERENCES incidents(id), FOREIGN KEY (asset_id) REFERENCES assets(id));
    CREATE TABLE IF NOT EXISTS security_events (id TEXT PRIMARY KEY, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, event_type TEXT NOT NULL, occurred_at TEXT NOT NULL, identity_id TEXT, device_id TEXT, session_id TEXT, asset_id TEXT, source TEXT NOT NULL, summary TEXT NOT NULL, attributes_json TEXT NOT NULL, FOREIGN KEY (identity_id) REFERENCES identities(id), FOREIGN KEY (device_id) REFERENCES devices(id), FOREIGN KEY (session_id) REFERENCES sessions(id), FOREIGN KEY (asset_id) REFERENCES assets(id));
    CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, event_id TEXT, type TEXT NOT NULL, summary TEXT NOT NULL, source TEXT NOT NULL, observed_at TEXT NOT NULL, details_json TEXT NOT NULL, FOREIGN KEY (event_id) REFERENCES security_events(id));
    CREATE INDEX IF NOT EXISTS idx_events_subject ON security_events(subject_type, subject_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_evidence_subject ON evidence(subject_type, subject_id, observed_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_identity ON sessions(identity_id, status);
    CREATE TABLE IF NOT EXISTS action_proposals (id TEXT PRIMARY KEY, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, action_type TEXT NOT NULL, parameters_json TEXT NOT NULL, status TEXT NOT NULL, proposed_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS approval_decisions (id TEXT PRIMARY KEY, action_id TEXT NOT NULL, decision TEXT NOT NULL, reviewed_by TEXT NOT NULL, reason TEXT, created_at TEXT NOT NULL, FOREIGN KEY (action_id) REFERENCES action_proposals(id));
    CREATE TABLE IF NOT EXISTS execution_records (id TEXT PRIMARY KEY, action_id TEXT NOT NULL, status TEXT NOT NULL, result_json TEXT, started_at TEXT, completed_at TEXT, FOREIGN KEY (action_id) REFERENCES action_proposals(id));
    CREATE TABLE IF NOT EXISTS verification_results (id TEXT PRIMARY KEY, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, action_id TEXT, status TEXT NOT NULL, observations_json TEXT NOT NULL, observed_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reasoning_runs (id TEXT PRIMARY KEY, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, status TEXT NOT NULL, input_hash TEXT NOT NULL, output_json TEXT, model TEXT, created_at TEXT NOT NULL, completed_at TEXT);
    CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, actor_type TEXT NOT NULL, actor_id TEXT, event_type TEXT NOT NULL, source TEXT NOT NULL, details_json TEXT NOT NULL, occurred_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS action_proposal_versions (
      action_id TEXT NOT NULL, proposal_version INTEGER NOT NULL, subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL, action_type TEXT NOT NULL, parameters_json TEXT NOT NULL,
      rationale TEXT NOT NULL, evidence_refs_json TEXT NOT NULL, status TEXT NOT NULL,
      created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (action_id, proposal_version)
    );
  `);
  ensureColumn(db, "approval_decisions", "proposal_version", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "execution_records", "proposal_version", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "execution_records", "target_identifier", "TEXT NOT NULL DEFAULT 'unspecified'");
  ensureColumn(db, "execution_records", "request_parameters_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, "execution_records", "idempotency_key", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "execution_records", "error_json", "TEXT");
  ensureColumn(db, "execution_records", "external_adapter", "TEXT");
  ensureColumn(db, "verification_results", "verification_type", "TEXT NOT NULL DEFAULT 'unspecified'");
  ensureColumn(db, "verification_results", "expected_state_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, "verification_results", "observed_state_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, "verification_results", "success", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "verification_results", "proposal_version", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "verification_results", "execution_id", "TEXT");
  ensureColumn(db, "verification_results", "actor_id", "TEXT");
  ensureColumn(db, "verification_results", "source", "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn(db, "verification_results", "started_at", "TEXT");
  ensureColumn(db, "verification_results", "failure_classification", "TEXT");
  ensureColumn(db, "verification_results", "idempotency_key", "TEXT");
  ensureColumn(db, "audit_events", "action_id", "TEXT");
  ensureColumn(db, "audit_events", "proposal_version", "INTEGER");
  ensureColumn(db, "audit_events", "execution_id", "TEXT");
  ensureColumn(db, "audit_events", "lifecycle_version", "INTEGER");
  ensureColumn(db, "reasoning_runs", "lifecycle_version", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "reasoning_runs", "prompt_version", "TEXT NOT NULL DEFAULT 'unknown'");
  ensureColumn(db, "reasoning_runs", "latency_ms", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "reasoning_runs", "usage_json", "TEXT");
  ensureColumn(db, "reasoning_runs", "failure_classification", "TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_idempotency_key ON execution_records(idempotency_key) WHERE idempotency_key <> ''");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_idempotency_key ON verification_results(idempotency_key) WHERE idempotency_key IS NOT NULL");
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((existing) => existing.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

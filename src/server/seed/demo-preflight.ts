import type Database from "better-sqlite3";
import type { IntegrationConfig } from "../config/integrations";
import { evaluateCapabilities } from "../webmcp/capability-policy";
import { CapabilityContextService } from "../webmcp/capability-context.service";
import { SqliteCapabilityContextRepository } from "../webmcp/sqlite-capability-context.repository";

export const EXPECTED_INITIAL_TOOLS=["inspect_incident","get_active_sessions","get_device_context","check_privilege_changes","review_evidence_timeline"] as const;
export interface ProviderCheck{configured:boolean;selected:boolean;success:boolean;detail:string}
export interface DemoPreflightReport{local:{state:string;version:number;proposals:number;approvals:number;executions:number;verifications:number;suspiciousSession:string;financePrivilege:string;ready:boolean};webmcp:{tools:string[];exactInitialSurface:boolean};auth0:ProviderCheck;elastic:ProviderCheck;ready:boolean}

const count=(db:Database.Database,sql:string)=>Number((db.prepare(sql).get()as{count:number}).count);
export function evaluateLocalDemoPreflight(db:Database.Database){
  const lifecycle=db.prepare("SELECT state,version FROM security_cases WHERE id='INC-1001'").get()as{state:string;version:number};
  const proposals=count(db,"SELECT COUNT(*) count FROM action_proposal_versions WHERE subject_type='INCIDENT' AND subject_id='INC-1001'");
  const approvals=count(db,"SELECT COUNT(*) count FROM approval_decisions WHERE action_id IN (SELECT id FROM action_proposals WHERE subject_type='INCIDENT' AND subject_id='INC-1001')");
  const executions=count(db,"SELECT COUNT(*) count FROM execution_records WHERE action_id IN (SELECT id FROM action_proposals WHERE subject_type='INCIDENT' AND subject_id='INC-1001')");
  const verifications=count(db,"SELECT COUNT(*) count FROM verification_results WHERE subject_type='INCIDENT' AND subject_id='INC-1001'");
  const suspiciousSession=String((db.prepare("SELECT status FROM sessions WHERE id='SES-ASHA-SUSPICIOUS'").get()as{status:string}).status);
  const financePrivilege=String((db.prepare("SELECT status FROM privileges WHERE id='PRV-ASHA-FINADMIN'").get()as{status:string}).status);
  const tools=evaluateCapabilities(new CapabilityContextService(new SqliteCapabilityContextRepository(db)).load("INCIDENT","INC-1001")).allowed.map(value=>value.toolName).sort();
  const exactInitialSurface=JSON.stringify(tools)===JSON.stringify([...EXPECTED_INITIAL_TOOLS].sort());
  const ready=lifecycle.state==="INVESTIGATING"&&lifecycle.version===3&&!proposals&&!approvals&&!executions&&!verifications&&suspiciousSession==="ACTIVE"&&financePrivilege==="ACTIVE";
  return{local:{state:lifecycle.state,version:lifecycle.version,proposals,approvals,executions,verifications,suspiciousSession,financePrivilege,ready},webmcp:{tools,exactInitialSurface}};
}

export function integrationSelection(config:IntegrationConfig){return{auth0:config.IDENTITY_PROVIDER==="auth0",elastic:config.SECURITY_EVENT_SOURCE==="elastic"}}
export function formatDemoPreflight(report:DemoPreflightReport){return[
  "LOCAL DEMO STATE",`  incident: ${report.local.state} v${report.local.version}`,`  workflow records: proposals=${report.local.proposals} approvals=${report.local.approvals} executions=${report.local.executions} verifications=${report.local.verifications}`,`  fixture state: session=${report.local.suspiciousSession} privilege=${report.local.financePrivilege}`,`  ready: ${report.local.ready}`,
  "WEBMCP INITIAL SURFACE",`  tools: ${report.webmcp.tools.join(", ")}`,`  exact five-tool surface: ${report.webmcp.exactInitialSurface}`,
  "AUTH0",`  configured: ${report.auth0.configured}`,`  selected: ${report.auth0.selected}`,`  check: ${report.auth0.success?"PASS":"FAIL"} — ${report.auth0.detail}`,
  "ELASTIC",`  configured: ${report.elastic.configured}`,`  selected: ${report.elastic.selected}`,`  check: ${report.elastic.success?"PASS":"FAIL"} — ${report.elastic.detail}`,`READY: ${report.ready}`].join("\n")}

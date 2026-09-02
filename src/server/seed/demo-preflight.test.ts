import Database from "better-sqlite3";
import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { getIntegrationConfig } from "../config/integrations";
import { initializeSecuritySchema } from "../db/security-schema";
import { seedSecurityData } from "./seed-security-data";
import { resetDemoState } from "./reset-demo-state";
import { evaluateLocalDemoPreflight,formatDemoPreflight,integrationSelection,type DemoPreflightReport } from "./demo-preflight";

describe("demo preflight",()=>{let db:Database.Database;beforeEach(()=>{db=new Database(":memory:");initializeSecuritySchema(db);seedSecurityData(db)});afterEach(()=>db.close());
  it("accepts the deterministic clean fixture and exact initial capability surface",()=>{resetDemoState(db);const result=evaluateLocalDemoPreflight(db);expect(result.local).toMatchObject({state:"INVESTIGATING",version:3,proposals:0,approvals:0,executions:0,verifications:0,ready:true});expect(result.webmcp).toMatchObject({exactInitialSurface:true});expect(result.webmcp.tools).toEqual(["check_privilege_changes","get_active_sessions","get_device_context","inspect_incident","review_evidence_timeline"])});
  it("fails closed when workflow state is dirty",()=>{db.prepare("UPDATE security_cases SET state='CONTAINED',version=8 WHERE id='INC-1001'").run();const result=evaluateLocalDemoPreflight(db);expect(result.local.ready).toBe(false);expect(result.webmcp.exactInitialSurface).toBe(false)});
  it("reports provider selection without credentials",()=>{const config=getIntegrationConfig({...process.env,IDENTITY_PROVIDER:"demo",SECURITY_EVENT_SOURCE:"sqlite",AUTH0_DOMAIN:undefined,AUTH0_CLIENT_ID:undefined,AUTH0_CLIENT_SECRET:undefined,AUTH0_MANAGEMENT_AUDIENCE:undefined,AUTH0_ASHA_USER_ID:undefined,ELASTIC_ENDPOINT:undefined,ELASTIC_API_KEY:undefined});expect(integrationSelection(config)).toEqual({auth0:false,elastic:false});
    const report:DemoPreflightReport={...evaluateLocalDemoPreflight(db),auth0:{configured:true,selected:true,success:false,detail:"AUTH0_UNAUTHORIZED"},elastic:{configured:true,selected:true,success:false,detail:"ELASTIC_REQUEST_FAILED (HTTP 404)"},ready:false};const output=formatDemoPreflight(report);expect(output).not.toContain("super-secret");expect(output).not.toContain("api-key");expect(output).toContain("READY: false")});
});

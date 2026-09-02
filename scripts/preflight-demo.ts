import Database from "better-sqlite3";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import { getIntegrationConfig } from "../src/server/config/integrations";
import { SqliteSecurityContextRepository } from "../src/server/repositories/sqlite-security-context.repository";
import { createIdentityIntegration } from "../src/server/integrations/identity-integration.factory";
import { createSecurityEventSource } from "../src/server/integrations/security-event-source.factory";
import { evaluateLocalDemoPreflight,formatDemoPreflight,type DemoPreflightReport } from "../src/server/seed/demo-preflight";
import { securityFixture } from "../src/server/seed/security-fixture";

async function main(){loadEnvConfig(process.cwd());
const config=getIntegrationConfig(process.env),database=new Database(resolve(process.env.DATABASE_PATH??"./data/security-ops.db"),{readonly:true});
const safeFailure=(cause:unknown)=>{if(!cause||typeof cause!=="object")return"provider check failed";const code="code"in cause?String(cause.code):"provider check failed";const status="status"in cause&&typeof cause.status==="number"?` (HTTP ${cause.status})`:"";return`${code}${status}`};
try{
  const state=evaluateLocalDemoPreflight(database),repository=new SqliteSecurityContextRepository(database);
  const authConfigured=Boolean(config.AUTH0_DOMAIN&&config.AUTH0_CLIENT_ID&&config.AUTH0_CLIENT_SECRET&&config.AUTH0_MANAGEMENT_AUDIENCE&&config.AUTH0_ASHA_USER_ID);
  let auth0:DemoPreflightReport["auth0"]={configured:authConfigured,selected:config.IDENTITY_PROVIDER==="auth0",success:false,detail:"Auth0 is not fully configured."};
  if(authConfigured){try{const provider=createIdentityIntegration(database,repository,{...config,IDENTITY_PROVIDER:"auth0"}).provider;
    const [identity,privileges]=await Promise.all([provider.getIdentity("IDN-ASHA"),provider.getGroupsOrPrivileges("IDN-ASHA")]);
    const expectedEmail=securityFixture.identities.find(value=>value.id==="IDN-ASHA")!.email,role=privileges.find(value=>value.id==="PRV-ASHA-FINADMIN");
    const identityMatches=identity?.email===expectedEmail,rolePresent=role?.status==="ACTIVE",success=identityMatches&&rolePresent;auth0={configured:true,selected:config.IDENTITY_PROVIDER==="auth0",success,detail:success?"Dedicated Asha identity resolved; Finance Administrator role is present.":!identityMatches?"Configured Auth0 user does not match the dedicated Asha fixture email.":"Dedicated Asha identity resolved; Finance Administrator role is absent."};
  }catch(cause){auth0={configured:true,selected:config.IDENTITY_PROVIDER==="auth0",success:false,detail:safeFailure(cause)}}}
  const elasticConfigured=Boolean(config.ELASTIC_ENDPOINT&&config.ELASTIC_API_KEY);let elastic:DemoPreflightReport["elastic"]={configured:elasticConfigured,selected:config.SECURITY_EVENT_SOURCE==="elastic",success:false,detail:"Elastic is not fully configured."};
  if(elasticConfigured){try{const source=createSecurityEventSource(database,{...config,SECURITY_EVENT_SOURCE:"elastic"});const events=await source.getEventsForIncident("INC-1001");
    const success=events.some(value=>value.id==="EVT-1002")&&events.some(value=>value.id==="EVT-1005");elastic={configured:true,selected:config.SECURITY_EVENT_SOURCE==="elastic",success,detail:success?`INC-1001 query returned ${events.length} events including login and privilege evidence.`:"INC-1001 expected evidence is missing."};
  }catch(cause){elastic={configured:true,selected:config.SECURITY_EVENT_SOURCE==="elastic",success:false,detail:safeFailure(cause)}}}
  const report:DemoPreflightReport={...state,auth0,elastic,ready:state.local.ready&&state.webmcp.exactInitialSurface&&auth0.selected&&auth0.success&&elastic.selected&&elastic.success};
  console.log(formatDemoPreflight(report));if(!report.ready)process.exitCode=1;
}finally{database.close()}}
void main().catch(cause=>{console.error(cause instanceof Error?cause.message:"Demo preflight failed.");process.exitCode=1});

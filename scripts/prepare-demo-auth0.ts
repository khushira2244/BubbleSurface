import { loadEnvConfig } from "@next/env";
import { getIntegrationConfig } from "../src/server/config/integrations";
import { Auth0ManagementClient } from "../src/server/integrations/auth0/auth0-management.client";
import { Auth0ManagementTokenClient } from "../src/server/integrations/auth0/auth0-token.client";
import { AUTH0_FINANCE_ROLE_NAME } from "../src/server/integrations/auth0/auth0-identity.adapter";
import { securityFixture } from "../src/server/seed/security-fixture";

async function main(){loadEnvConfig(process.cwd());const config=getIntegrationConfig(process.env);
if(config.IDENTITY_PROVIDER!=="auth0"||!config.AUTH0_ASHA_USER_ID)throw new Error("Auth0 demo preparation requires IDENTITY_PROVIDER=auth0 and the complete AUTH0_* configuration.");
const tokens=new Auth0ManagementTokenClient({domain:config.AUTH0_DOMAIN!,clientId:config.AUTH0_CLIENT_ID!,clientSecret:config.AUTH0_CLIENT_SECRET!,audience:config.AUTH0_MANAGEMENT_AUDIENCE!});
const client=new Auth0ManagementClient(config.AUTH0_DOMAIN!,tokens),user=await client.getUser(config.AUTH0_ASHA_USER_ID),expected=securityFixture.identities.find(value=>value.id==="IDN-ASHA")!;
if(user.user_id!==config.AUTH0_ASHA_USER_ID||user.email!==expected.email)throw new Error("Configured Auth0 target is not the dedicated Asha demo identity; no mutation was performed.");
const [assigned,roles]=await Promise.all([client.getUserRoles(user.user_id),client.listRoles()]);const role=roles.find(value=>value.name===AUTH0_FINANCE_ROLE_NAME);
if(!role)throw new Error(`Auth0 role ${AUTH0_FINANCE_ROLE_NAME} does not exist; no mutation was performed.`);
const alreadyAssigned=assigned.some(value=>value.id===role.id);if(!alreadyAssigned)await client.assignUserRole(user.user_id,role.id);
console.log(JSON.stringify({target:"dedicated Asha demo identity",role:AUTH0_FINANCE_ROLE_NAME,changed:!alreadyAssigned,status:"READY"},null,2));}
void main().catch(cause=>{console.error(cause instanceof Error?cause.message:"Auth0 demo preparation failed.");process.exitCode=1});

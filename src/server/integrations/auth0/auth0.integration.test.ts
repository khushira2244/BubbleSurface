import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeSecuritySchema } from "../../db/security-schema";
import { getIntegrationConfig } from "../../config/integrations";
import { SecurityContextService } from "../../domain/security/security-context.service";
import { readIdentityPrivileges } from "../../http/security-read-http";
import { DemoIdentityActionExecutor } from "../../execution/demo-identity-action.executor";
import { SqliteSecurityContextRepository } from "../../repositories/sqlite-security-context.repository";
import { seedSecurityData } from "../../seed/seed-security-data";
import { DemoIdentityVerificationSource } from "../../verification/demo-identity-verification.source";
import { SqliteIdentityAdapter } from "../sqlite-identity.adapter";
import { createIdentityIntegration } from "../identity-integration.factory";
import { Auth0IdentityActionExecutor } from "./auth0-identity-action.executor";
import { Auth0IdentityAdapter, FINANCE_PRIVILEGE_ID } from "./auth0-identity.adapter";
import { Auth0ManagementClient } from "./auth0-management.client";
import { Auth0ManagementTokenClient } from "./auth0-token.client";
import { Auth0VerificationSource } from "./auth0-verification.source";
import { Auth0ProviderError } from "./auth0.errors";

describe("Auth0 identity integration",()=>{
  let db:Database.Database|undefined;
  afterEach(()=>db?.close());
  it("uses client credentials and caches the token until its refresh window",async()=>{
    let now=0;
    const fetcher=vi.fn(async(_url:string|URL|Request,_init?:RequestInit)=>new Response(JSON.stringify({access_token:"private-token",expires_in:120}),{status:200}));
    const client=new Auth0ManagementTokenClient({domain:"tenant.example",clientId:"client",clientSecret:"secret",audience:"https://tenant.example/api/v2/"},fetcher as typeof fetch,()=>now);
    expect(await client.getToken()).toBe("private-token");expect(await client.getToken()).toBe("private-token");expect(fetcher).toHaveBeenCalledTimes(1);
    const [url,init]=fetcher.mock.calls[0];expect(url).toBe("https://tenant.example/oauth/token");
    expect(JSON.parse(String(init?.body))).toEqual({grant_type:"client_credentials",client_id:"client",client_secret:"secret",audience:"https://tenant.example/api/v2/"});
    now=61_000;await client.getToken();expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("maps the configured Auth0 role to the stable product privilege",async()=>{
    db=new Database(":memory:");initializeSecuritySchema(db);seedSecurityData(db);
    const fallback=new SqliteIdentityAdapter(new SqliteSecurityContextRepository(db));
    const client={getUser:vi.fn(async()=>({user_id:"auth0|asha",name:"Asha Auth0",email:"asha@example.com"})),getUserRoles:vi.fn(async()=>[{id:"role-fin",name:"Finance Administrator"}])} as unknown as Auth0ManagementClient;
    const adapter=new Auth0IdentityAdapter(client,fallback,"auth0|asha");
    expect(await adapter.getIdentity("IDN-ASHA")).toMatchObject({displayName:"Asha Auth0",source:"auth0"});
    expect(await adapter.getGroupsOrPrivileges("IDN-ASHA")).toContainEqual(expect.objectContaining({id:FINANCE_PRIVILEGE_ID,status:"ACTIVE",source:"simulated-iam"}));
    client.getUserRoles=vi.fn(async()=>[]);expect(await adapter.getGroupsOrPrivileges("IDN-ASHA")).toContainEqual(expect.objectContaining({id:FINANCE_PRIVILEGE_ID,status:"REVOKED"}));
  });
  it("removes only the exact mapped role and preserves unrelated roles",async()=>{
    db=new Database(":memory:");initializeSecuritySchema(db);seedSecurityData(db);
    const client={getUserRoles:vi.fn(async()=>[{id:"other",name:"Other"},{id:"role-fin",name:"Finance Administrator"}]),removeUserRole:vi.fn(async()=>undefined)} as unknown as Auth0ManagementClient;
    const executor=new Auth0IdentityActionExecutor(client,"auth0|asha",new DemoIdentityActionExecutor(db));
    await executor.removePrivileges([FINANCE_PRIVILEGE_ID]);expect(client.removeUserRole).toHaveBeenCalledWith("auth0|asha","role-fin");expect(client.removeUserRole).toHaveBeenCalledTimes(1);
    await expect(executor.removePrivileges(["UNRELATED"])).rejects.toMatchObject({code:"AUTH0_MAPPING_REJECTED"});expect(client.removeUserRole).toHaveBeenCalledTimes(1);
  });
  it("uses the exact encoded DELETE endpoint and maps upstream errors",async()=>{
    const tokens={getToken:vi.fn(async()=>"token")} as unknown as Auth0ManagementTokenClient;
    const ok=vi.fn(async(_url:string|URL|Request,_init?:RequestInit)=>new Response(null,{status:204}));const client=new Auth0ManagementClient("tenant.example",tokens,ok as typeof fetch);
    await client.removeUserRole("auth0|asha","role-fin");const [url,init]=ok.mock.calls[0];expect(url).toBe("https://tenant.example/api/v2/users/auth0%7Casha/roles");expect(init?.method).toBe("DELETE");expect(JSON.parse(String(init?.body))).toEqual({roles:["role-fin"]});
    for(const [status,code] of [[401,"AUTH0_UNAUTHORIZED"],[403,"AUTH0_FORBIDDEN"],[404,"AUTH0_NOT_FOUND"],[429,"AUTH0_RATE_LIMITED"],[500,"AUTH0_UPSTREAM_FAILURE"]] as const){const failing=new Auth0ManagementClient("tenant.example",tokens,vi.fn(async()=>new Response(JSON.stringify({message:"safe failure"}),{status,headers:{"x-request-id":"req-1"}})) as typeof fetch);await expect(failing.getUser("auth0|asha")).rejects.toMatchObject({code,status,requestId:"req-1"});}
  });
  it("assigns the exact role using the encoded dedicated-user endpoint",async()=>{const tokens={getToken:vi.fn(async()=>"token")}as unknown as Auth0ManagementTokenClient;
    const fetcher=vi.fn(async(_url:string|URL|Request,_init?:RequestInit)=>new Response(null,{status:204})),client=new Auth0ManagementClient("tenant.example",tokens,fetcher as typeof fetch);await client.assignUserRole("auth0|asha","role-fin");
    const[url,init]=fetcher.mock.calls[0];expect(url).toBe("https://tenant.example/api/v2/users/auth0%7Casha/roles");expect(init?.method).toBe("POST");expect(JSON.parse(String(init?.body))).toEqual({roles:["role-fin"]})});
  it("verification performs fresh role reads and passes only after the role is absent",async()=>{
    db=new Database(":memory:");initializeSecuritySchema(db);seedSecurityData(db);
    const roles=vi.fn().mockResolvedValueOnce([{id:"role-fin",name:"Finance Administrator"}]).mockResolvedValueOnce([]);
    const client={getUser:vi.fn(async()=>({user_id:"auth0|asha"})),getUserRoles:roles} as unknown as Auth0ManagementClient;
    const source=new Auth0VerificationSource(client,"auth0|asha",new DemoIdentityVerificationSource(db));
    expect((await source.observeIdentity("IDN-ASHA")).privileges).toContainEqual(expect.objectContaining({id:FINANCE_PRIVILEGE_ID,status:"ACTIVE"}));
    expect((await source.observeIdentity("IDN-ASHA")).privileges).toContainEqual(expect.objectContaining({id:FINANCE_PRIVILEGE_ID,status:"REVOKED"}));expect(roles).toHaveBeenCalledTimes(2);
  });
  it("classifies network failures without exposing credentials",async()=>{
    const client=new Auth0ManagementTokenClient({domain:"tenant.example",clientId:"client",clientSecret:"do-not-expose",audience:"audience"},vi.fn(async()=>{throw new Error("network")}) as typeof fetch);
    const error=await client.getToken().catch(value=>value);expect(error).toBeInstanceOf(Auth0ProviderError);expect(error).toMatchObject({code:"AUTH0_NETWORK_ERROR"});expect(String(error.message)).not.toContain("do-not-expose");
  });
  it("routes the privileges HTTP endpoint through Auth0 and exposes provider separately",async()=>{
    db=new Database(":memory:");initializeSecuritySchema(db);seedSecurityData(db);
    const repository=new SqliteSecurityContextRepository(db),service=new SecurityContextService(repository);
    const fetcher=vi.fn(async(url:string|URL|Request)=>String(url).endsWith("/oauth/token")
      ?new Response(JSON.stringify({access_token:"mock-token",expires_in:3600}),{status:200})
      :new Response(JSON.stringify([{id:"role-fin",name:"Finance Administrator"}]),{status:200}));
    const config=getIntegrationConfig({...process.env,IDENTITY_PROVIDER:"auth0",AUTH0_DOMAIN:"tenant.example",AUTH0_CLIENT_ID:"client",AUTH0_CLIENT_SECRET:"secret",AUTH0_MANAGEMENT_AUDIENCE:"https://tenant.example/api/v2/",AUTH0_ASHA_USER_ID:"auth0|asha"});
    const integration=createIdentityIntegration(db,repository,config,fetcher as typeof fetch);
    const response=await readIdentityPrivileges(service,integration.provider)(new Request("http://localhost/api/identities/IDN-ASHA/privileges"),{params:Promise.resolve({id:"IDN-ASHA"})});
    expect(response.status).toBe(200);const body=await response.json();
    expect(body.data).toContainEqual(expect.objectContaining({id:FINANCE_PRIVILEGE_ID,status:"ACTIVE",source:"simulated-iam",provider:"auth0"}));
    expect(fetcher.mock.calls.some(([url])=>String(url).endsWith("/api/v2/users/auth0%7Casha/roles"))).toBe(true);
  });
});

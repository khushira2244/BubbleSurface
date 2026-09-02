import { describe,expect,it,vi } from "vitest";
import { invokeBrowserTool } from "./webmcp-http";
import { Auth0ProviderError } from "../integrations/auth0/auth0.errors";

describe("live WebMCP HTTP invocation",()=>{it("validates the tool name and routes the browser request through authoritative invocation",async()=>{
  const invoke=vi.fn(async(name,input,actorId)=>({kind:"incident_context",facts:{id:"INC-1001"},name,input,actorId}));
  const resolver={resolve:vi.fn(()=>({id:"browser-agent",type:"AGENT" as const,permissions:["INVESTIGATE"],roles:["DEMO_BROWSER_AGENT"]}))};
  const request=new Request("http://localhost/api/webmcp/invoke/inspect_incident",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({subjectId:"INC-1001",expectedLifecycleVersion:3})});
  const response=await invokeBrowserTool("inspect_incident",request,{invoke} as never,resolver);expect(response.status).toBe(200);
  expect(invoke).toHaveBeenCalledWith("inspect_incident",{subjectId:"INC-1001",expectedLifecycleVersion:3},"browser-agent");
});});
it("routes prepare_containment through the same authoritative HTTP invocation boundary",async()=>{const invoke=vi.fn(async()=>({status:"REVIEW_REQUIRED"}));
  const resolver={resolve:()=>({id:"browser-agent",type:"AGENT" as const,permissions:["PREPARE"],roles:["DEMO_BROWSER_AGENT"]})};
  const request=new Request("http://localhost/api/webmcp/invoke/prepare_containment",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({subjectId:"INC-1001",expectedLifecycleVersion:4,requestedActions:["REMOVE_PRIVILEGE"],evidenceRefs:["EVD-1003"]})});
  const response=await invokeBrowserTool("prepare_containment",request,{invoke} as never,resolver);expect(response.status).toBe(200);
  expect(invoke).toHaveBeenCalledWith("prepare_containment",expect.objectContaining({requestedActions:["REMOVE_PRIVILEGE"]}),"browser-agent");});
it("returns a safe classified Auth0 upstream error instead of an opaque 500",async()=>{const invocation={invoke:vi.fn(async()=>{throw new Auth0ProviderError("AUTH0_RATE_LIMITED","Auth0 rate limit reached.",429,"private-request-id")})};
  const resolver={resolve:()=>({id:"browser-agent",type:"AGENT" as const,permissions:["INVESTIGATE" as const],roles:["DEMO_BROWSER_AGENT"]})};
  const request=new Request("http://localhost/api/webmcp/invoke/check_privilege_changes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({subjectId:"INC-1001",expectedLifecycleVersion:3})});
  const response=await invokeBrowserTool("check_privilege_changes",request,invocation as never,resolver),body=await response.json();expect(response.status).toBe(502);expect(body).toEqual({error:{code:"AUTH0_RATE_LIMITED",message:"Auth0 rate limit reached.",provider:"auth0"}});expect(JSON.stringify(body)).not.toContain("private-request-id");});

import { describe,expect,it,vi } from "vitest";
import { invokeBrowserTool } from "./webmcp-http";

describe("live WebMCP HTTP invocation",()=>{it("validates the tool name and routes the browser request through authoritative invocation",async()=>{
  const invoke=vi.fn(async(name,input,actorId)=>({kind:"incident_context",facts:{id:"INC-1001"},name,input,actorId}));
  const resolver={resolve:vi.fn(()=>({id:"browser-agent",type:"AGENT" as const,permissions:["INVESTIGATE"],roles:["DEMO_BROWSER_AGENT"]}))};
  const request=new Request("http://localhost/api/webmcp/invoke/inspect_incident",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({subjectId:"INC-1001",expectedLifecycleVersion:3})});
  const response=await invokeBrowserTool("inspect_incident",request,{invoke} as never,resolver);expect(response.status).toBe(200);
  expect(invoke).toHaveBeenCalledWith("inspect_incident",{subjectId:"INC-1001",expectedLifecycleVersion:3},"browser-agent");
});});

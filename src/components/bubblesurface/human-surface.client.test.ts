import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpHumanSurfaceClient } from "./human-surface.client";

const jsonResponse=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{"content-type":"application/json"}});

describe("HttpHumanSurfaceClient review payloads",()=>{
  afterEach(()=>vi.unstubAllGlobals());

  it.each([
    ["approve",{actionId:"ACT-7",proposalVersion:1,expectedLifecycleVersion:6},
      {proposalVersion:1,expectedLifecycleVersion:6}],
    ["reject",{actionId:"ACT-7",proposalVersion:1,expectedLifecycleVersion:6,comment:"Not justified."},
      {proposalVersion:1,expectedLifecycleVersion:6,comment:"Not justified."}],
    ["modify",{actionId:"ACT-7",proposalVersion:1,expectedLifecycleVersion:6,parameters:{privilegeIds:["PRV-7"]},rationale:"Narrow target."},
      {proposalVersion:1,expectedLifecycleVersion:6,parameters:{privilegeIds:["PRV-7"]},rationale:"Narrow target."}],
  ] as const)("%s keeps actionId in the URL and sends only the strict review body",async(kind,input,expectedBody)=>{
    const fetchMock=vi.fn(async(_url:string,_init?:RequestInit)=>jsonResponse({ok:true}));vi.stubGlobal("fetch",fetchMock);
    const client=new HttpHumanSurfaceClient("https://surface.example");
    const result=await client[kind](input);
    expect(result).toEqual({ok:true});
    expect(fetchMock).toHaveBeenCalledWith(`https://surface.example/api/actions/ACT-7/${kind}`,expect.objectContaining({
      method:"POST",body:JSON.stringify(expectedBody),
    }));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).not.toHaveProperty("actionId");
  });
});

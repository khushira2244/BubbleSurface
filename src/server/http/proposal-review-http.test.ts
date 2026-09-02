import { describe,expect,it } from "vitest";
import { reviewAction } from "./proposal-review-http";

describe("proposal review HTTP schema",()=>{
  it.each(["approve","reject","modify"] as const)("keeps %s request bodies strict",async(kind)=>{
    const request=new Request(`http://localhost/api/actions/ACT-7/${kind}`,{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({actionId:"ACT-7",proposalVersion:1,expectedLifecycleVersion:6})});
    const response=await reviewAction("ACT-7",kind,request),body=await response.json();
    expect(response.status).toBe(400);expect(body.error).toMatchObject({code:"VALIDATION_ERROR",message:"Proposal review request is invalid."});
  });
});

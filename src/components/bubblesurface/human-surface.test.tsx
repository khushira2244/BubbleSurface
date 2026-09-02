import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { ApprovalClient } from "@/server/webmcp/integration-contracts";
import { RefreshingApprovalClient } from "../../server/webmcp/approval-refresh.client";
import { HumanReviewController } from "./human-surface.client";
import { ActivityTimeline, BubbleSurfacePanel, ExecutionStatus, VerificationStatus } from "./human-surface";
import type { HumanSurfaceModel } from "./human-surface.types";
import { mapControlPlaneToHumanSurface } from "./human-surface.viewmodel";

const subject={id:"CASE-7",type:"SECURITY_CASE",label:"Case 7",title:"Review requested action"};
const rawAction=(overrides:Record<string,unknown>={})=>({actionId:"ACTION-7",currentVersion:1,latest:{id:"ACTION-7",proposalVersion:1,
  actionType:"ISOLATE_ENDPOINT",actionDescription:"Isolate affected endpoint",rationale:"Observed behavior requires containment.",
  parameters:{endpointIds:["ENDPOINT-4"],lifecycleVersion:6},lifecycleVersion:6,proposalState:"PROPOSED",approvalState:"NONE",
  reviewState:"PENDING_REVIEW",createdAt:"2026-01-02T03:04:05.000Z",updatedAt:"2026-01-02T03:04:05.000Z",...overrides}});
const model=(action=rawAction(),executions:Record<string,unknown>[]=[],verifications:Record<string,unknown>[]=[])=>
  mapControlPlaneToHumanSurface({subject,action,executions,verifications});

describe("BubbleSurface human surface",()=>{
  it("renders the human-review-required proposal, target, reason, and exact version",()=>{
    const html=renderToStaticMarkup(<BubbleSurfacePanel model={model()} mode="standalone"/>);
    expect(html).toContain("Human review required");expect(html).toContain("Proposal v1");
    expect(html).toContain("Isolate affected endpoint");expect(html).toContain("Observed behavior requires containment.");
    expect(html).toContain("Case 7");
  });

  it("approve uses the refresh-enabled approval client and reloads authoritative UI state",async()=>{
    const base:ApprovalClient={list:vi.fn(),read:vi.fn(),approve:vi.fn(async()=>({decision:"APPROVED"})),reject:vi.fn(),modify:vi.fn()};
    const refresh=vi.fn(async()=>undefined),approvals=new RefreshingApprovalClient(base,{refresh});
    const approved=model(rawAction({approvalState:"APPROVED",reviewState:"APPROVED"}));
    const reload=vi.fn(async()=>approved),controller=new HumanReviewController(approvals,reload);
    expect((await controller.approve({actionId:"ACTION-7",proposalVersion:1,expectedLifecycleVersion:6})).status).toBe("APPROVED");
    expect(base.approve).toHaveBeenCalledOnce();expect(refresh).toHaveBeenCalledOnce();expect(reload).toHaveBeenCalledOnce();
  });

  it("reject and modify return the reloaded authoritative state, with modification showing the latest version",async()=>{
    const rejected=model(rawAction({approvalState:"REJECTED",reviewState:"REJECTED"}));
    const latest=model({actionId:"ACTION-7",currentVersion:2,latest:{...rawAction().latest,proposalVersion:2,rationale:"Narrowed target.",
      approvalState:"NONE",reviewState:"PENDING_REVIEW"}});
    const approvals:ApprovalClient={list:vi.fn(),read:vi.fn(),approve:vi.fn(),reject:vi.fn(async()=>({})),modify:vi.fn(async()=>({}))};
    const reload=vi.fn().mockResolvedValueOnce(rejected).mockResolvedValueOnce(latest),controller=new HumanReviewController(approvals,reload);
    expect((await controller.reject({actionId:"ACTION-7",proposalVersion:1,expectedLifecycleVersion:6})).status).toBe("REJECTED");
    const changed=await controller.modify({actionId:"ACTION-7",proposalVersion:1,expectedLifecycleVersion:6,
      parameters:{endpointIds:["ENDPOINT-8"]},rationale:"Narrowed target."});
    expect(changed.proposal).toMatchObject({version:2,approvalState:"NONE",reviewable:true});
    expect(renderToStaticMarkup(<BubbleSurfacePanel model={changed}/>)).toContain("Proposal v2");
  });

  it("does not render clickable decision controls for stale or superseded proposals",()=>{
    const stale=model({actionId:"ACTION-7",currentVersion:2,latest:{...rawAction().latest,proposalVersion:1}});
    const superseded=model(rawAction({proposalState:"SUPERSEDED",reviewState:"SUPERSEDED"}));
    for(const value of [stale,superseded]){const html=renderToStaticMarkup(<BubbleSurfacePanel model={value} approvalClient={{} as ApprovalClient} reload={async()=>value}/>);
      expect(html).not.toContain("Approve exact version");expect(html).not.toContain(">Reject<");expect(html).not.toContain(">Modify<");}
    expect(stale.status).toBe("STALE");expect(superseded.status).toBe("SUPERSEDED");
  });

  it.each([["IN_PROGRESS","In progress"],["SUCCEEDED","Succeeded"],["FAILED","Failed"]])
    ("renders execution state %s",(state,label)=>{const value=model(rawAction({approvalState:"APPROVED",reviewState:"APPROVED"}),[{status:state,error:state==="FAILED"?{message:"Provider rejected the request."}:null}]);
      const html=renderToStaticMarkup(<ExecutionStatus model={value}/>);expect(html).toContain(label);if(state==="FAILED")expect(html).toContain("Provider rejected");});

  it("renders passed and failed verification without relying on color alone",()=>{
    const passed=model(rawAction({approvalState:"APPROVED",reviewState:"APPROVED"}),[{status:"SUCCEEDED"}],
      [{verificationType:"VERIFY_IDENTITY_STATE",success:true,status:"PASSED",checkedAt:"2026-01-02T04:00:00.000Z"},
        {verificationType:"VERIFY_CONTAINMENT",success:true,status:"PASSED",checkedAt:"2026-01-02T04:01:00.000Z"}]);
    const failed=model(rawAction({approvalState:"APPROVED",reviewState:"APPROVED"}),[{status:"SUCCEEDED"}],
      [{verificationType:"EXPECTED_STATE",success:false,status:"FAILED",checkedAt:"2026-01-02T04:00:00.000Z"}]);
    expect(renderToStaticMarkup(<VerificationStatus model={passed}/>)).toContain("Passed: Verify identity state");
    expect(renderToStaticMarkup(<VerificationStatus model={failed}/>)).toContain("Failed: Expected state");
    expect(passed.status).toBe("VERIFIED");expect(failed.status).toBe("VERIFICATION_FAILED");
  });
  it("does not show final verified status until both required verification kinds pass",()=>{
    const partial=model(rawAction({approvalState:"APPROVED",reviewState:"APPROVED"}),[{status:"SUCCEEDED"}],
      [{verificationType:"VERIFY_IDENTITY_STATE",success:true,status:"PASSED",checkedAt:"2026-01-02T04:00:00.000Z"}]);
    expect(partial.status).not.toBe("VERIFIED");expect(partial.verification.state).toBe("PENDING");
  });

  it("distinguishes agent, human, and system activity in the operational timeline",()=>{
    const events=[{id:"1",actorType:"AGENT" as const,label:"Inspected context",occurredAt:"2026-01-01T00:00:00.000Z"},
      {id:"2",actorType:"HUMAN" as const,label:"Approved proposal",occurredAt:"2026-01-01T00:01:00.000Z"},
      {id:"3",actorType:"SYSTEM" as const,label:"Capability surface refreshed",occurredAt:"2026-01-01T00:02:00.000Z"}];
    const html=renderToStaticMarkup(<ActivityTimeline events={events}/>);for(const actor of ["AGENT","HUMAN","SYSTEM"])expect(html).toContain(actor);
  });

  it("renders compact embedded mode with generic data and no vendor or demo dependency",()=>{
    const html=renderToStaticMarkup(<BubbleSurfacePanel model={model()} mode="embedded"/>);
    expect(html).toContain("BubbleSurface human intervention");expect(html).toContain("embedded");
    for(const forbidden of ["Elastic","Auth0","INC-1001","Asha","Frankfurt"])expect(html).not.toContain(forbidden);
  });
});

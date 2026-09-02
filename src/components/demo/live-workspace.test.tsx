import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { securityFixture } from "../../server/seed/security-fixture";
import { LiveWorkspace } from "./live-workspace";
import { buildLiveWorkspaceModel, deriveLiveWorkspacePresentation } from "./live-workspace.model";

const context={lifecycle:securityFixture.cases.find(value=>value.id==="INC-1001")!,incident:securityFixture.incidents.find(value=>value.id==="INC-1001")!,identity:securityFixture.identities.find(value=>value.id==="IDN-ASHA")!,devices:securityFixture.devices.filter(value=>value.identityId==="IDN-ASHA"),sessions:securityFixture.sessions.filter(value=>value.identityId==="IDN-ASHA"&&value.status==="ACTIVE"),privileges:securityFixture.privileges.filter(value=>value.identityId==="IDN-ASHA"),assets:securityFixture.assets.filter(value=>value.id==="AST-FINANCE"),events:securityFixture.events.filter(value=>value.subjectId==="INC-1001"),evidence:securityFixture.evidence.filter(value=>value.subjectId==="INC-1001")};
const tools=["inspect_incident","get_active_sessions","get_device_context","check_privilege_changes","review_evidence_timeline"].map(toolName=>({toolName,classification:"READ"}));
const html=renderToStaticMarkup(<LiveWorkspace model={buildLiveWorkspaceModel(context,tools)}/>);

describe("live demo workspace shell",()=>{
  it("renders the real incident and affected identity",()=>{expect(html).toContain("INC-1001");expect(html).toContain("Asha Mehta");expect(html).toContain("CRITICAL")});
  it("renders repository-backed evidence timeline facts",()=>{expect(html).toContain("unfamiliar device in Frankfurt");expect(html).toContain("Three MFA challenges failed");expect(html).toContain("Finance administrator role granted");expect(html).toContain("Payroll export configuration was opened")});
  it("renders current session and privilege state",()=>{expect(html).toContain("OIDC_REFRESH");expect(html).toContain("finance-admin");expect(html).toContain("Frankfurt, DE")});
  it("composes the reusable BubbleSurface panel in an idle state",()=>{expect(html).toContain('aria-label="BubbleSurface human intervention"');expect(html).toContain("No agent activity recorded.");expect(html).not.toContain("Human review required");expect(html).not.toContain("Approve exact version")});
  it("shows five current investigation capabilities and honest activity",()=>{expect(html).toContain("5</strong>");for(const tool of tools)expect(html).toContain(tool.toolName);expect(html).toContain("No agent or human workflow activity has been recorded yet.")});
  it("links back and declares the responsive shell contract",()=>{expect(html).toContain('href="/demo/test-case"');expect(html).toContain('data-responsive-shell="true"')});
  it("keeps the human authority controls in only the BubbleSurface panel",()=>{expect((html.match(/aria-label="BubbleSurface human intervention"/g)??[])).toHaveLength(1);expect(html).not.toContain("Next step")});
});

const human=(execution:"NONE"|"SUCCEEDED"|"FAILED"="NONE",checks:Array<{name:string;passed:boolean}>=[])=>({execution:{state:execution},verification:{state:checks.some(item=>!item.passed)?"FAILED":"PENDING",checks}} as Parameters<typeof deriveLiveWorkspacePresentation>[2]);

describe("authoritative live workspace presentation",()=>{
  it.each([["INVESTIGATING","Investigate"],["AWAITING_APPROVAL","Review"],["CONTAINING","Execute"],["CONTAINED","Verify"],["VERIFYING","Verify"],["RECOVERED","Recovered"]] as const)("maps %s to %s",(state,stage)=>expect(deriveLiveWorkspacePresentation(state,"ACTIVE",human()).currentStage).toBe(stage));
  it("shows active privilege before provider revocation",()=>expect(deriveLiveWorkspacePresentation("CONTAINING","ACTIVE",human()).privilegeRemoved).toBe(false));
  it("shows revoked privilege only from authoritative identity status",()=>expect(deriveLiveWorkspacePresentation("CONTAINED","REVOKED",human("SUCCEEDED")).privilegeRemoved).toBe(true));
  it("does not recover from execution success",()=>expect(deriveLiveWorkspacePresentation("CONTAINED","REVOKED",human("SUCCEEDED")).recovered).toBe(false));
  it("keeps recovery pending after one successful verification",()=>{const view=deriveLiveWorkspacePresentation("VERIFYING","REVOKED",human("SUCCEEDED",[{name:"VERIFY_IDENTITY_STATE",passed:true}]));expect(view.outcome.identityVerification).toBe("PASSED");expect(view.outcome.containmentVerification).toBe("PENDING");expect(view.outcome.incidentRecovered).toBe(false)});
  it("shows the full outcome only for authoritative recovery with both passes",()=>{const view=deriveLiveWorkspacePresentation("RECOVERED","REVOKED",human("SUCCEEDED",[{name:"VERIFY_IDENTITY_STATE",passed:true},{name:"VERIFY_CONTAINMENT",passed:true}]));expect(view.recovered).toBe(true);expect(view.outcome).toMatchObject({privilegeRemoval:"COMPLETED",identityVerification:"PASSED",containmentVerification:"PASSED",trustedSessionPreserved:true,incidentRecovered:true})});
  it("does not claim privilege removal after failed execution",()=>expect(deriveLiveWorkspacePresentation("CONTAINING","ACTIVE",human("FAILED")).outcome.privilegeRemoval).toBe("FAILED"));
  it("does not claim verification or recovery after a failed check",()=>{const view=deriveLiveWorkspacePresentation("VERIFYING","REVOKED",human("SUCCEEDED",[{name:"VERIFY_IDENTITY_STATE",passed:false}]));expect(view.outcome.identityVerification).toBe("FAILED");expect(view.outcome.incidentRecovered).toBe(false)});
});

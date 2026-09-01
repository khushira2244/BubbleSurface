import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeSecuritySchema } from "../db/security-schema";
import { ControlPlaneService } from "../domain/control-plane/control-plane.service";
import { EvidenceReferenceValidator, InvalidEvidenceReferenceError } from "../domain/control-plane/evidence-reference.validator";
import { SecurityContextService } from "../domain/security/security-context.service";
import { SqliteIdentityAdapter } from "../integrations/sqlite-identity.adapter";
import { SqliteSecurityEventAdapter } from "../integrations/sqlite-security-event.adapter";
import { SqliteControlPlaneRepository } from "../repositories/sqlite-control-plane.repository";
import { SqliteSecurityContextRepository } from "../repositories/sqlite-security-context.repository";
import { seedSecurityData } from "../seed/seed-security-data";
import type { BrowserWebMcpAdapter } from "./browser-webmcp.adapter";
import { CapabilityContextService, CapabilitySubjectNotFoundError } from "./capability-context.service";
import { CapabilityRefreshService } from "./capability-refresh.service";
import { SqliteCapabilityContextRepository } from "./sqlite-capability-context.repository";
import { createWebMcpToolDefinitions } from "./tool-definitions";
import { StaleCapabilityContextError, StaleProposalApprovalError, ToolInvocationService } from "./tool-invocation.service";
import { ControlPlaneWebMcpAuditRecorder } from "./webmcp-audit";
import type { BrowserToolRegistration } from "./webmcp-tool.types";

class MemoryBrowserAdapter implements BrowserWebMcpAdapter {
  readonly tools = new Map<string, BrowserToolRegistration>();
  isAvailable() { return true; }
  async register(tool: BrowserToolRegistration) { this.tools.set(tool.name, tool); return true; }
  async unregister(toolName: string) { return this.tools.delete(toolName); }
}

describe("WebMCP capability infrastructure", () => {
  let db: Database.Database;
  let controlPlane: ControlPlaneService;
  let contexts: CapabilityContextService;
  let invocations: ToolInvocationService;
  let refresh: CapabilityRefreshService;
  let browser: MemoryBrowserAdapter;
  beforeEach(() => {
    db = new Database(":memory:"); initializeSecuritySchema(db); seedSecurityData(db);
    const securityRepository = new SqliteSecurityContextRepository(db);
    const securityContext = new SecurityContextService(securityRepository);
    controlPlane = new ControlPlaneService(new SqliteControlPlaneRepository(db), new EvidenceReferenceValidator(securityRepository));
    const audit = new ControlPlaneWebMcpAuditRecorder(controlPlane);
    contexts = new CapabilityContextService(new SqliteCapabilityContextRepository(db));
    const tools = createWebMcpToolDefinitions({ securityContext, identityProvider: new SqliteIdentityAdapter(securityRepository),
      eventSource: new SqliteSecurityEventAdapter(db), evidenceValidator: new EvidenceReferenceValidator(securityRepository) });
    invocations = new ToolInvocationService(contexts, tools, audit);
    browser = new MemoryBrowserAdapter();
    refresh = new CapabilityRefreshService(contexts, tools, invocations, browser, audit);
  });
  afterEach(() => db.close());

  it("revalidates authority and audits called and stale blocked invocations", async () => {
    const output = await invocations.invoke("inspect_incident", { subjectId: "INC-1001", expectedLifecycleVersion: 3 });
    expect(output).toMatchObject({ kind: "incident_context" });
    db.prepare("UPDATE security_cases SET version = 4 WHERE id = 'INC-1001'").run();
    await expect(invocations.invoke("inspect_incident", { subjectId: "INC-1001", expectedLifecycleVersion: 3 }))
      .rejects.toBeInstanceOf(StaleCapabilityContextError);
    const events = db.prepare("SELECT event_type FROM audit_events ORDER BY occurred_at").all() as Array<{ event_type: string }>;
    expect(events.map((event) => event.event_type)).toEqual(["WEBMCP_TOOL_CALLED", "WEBMCP_TOOL_SUCCEEDED", "WEBMCP_TOOL_BLOCKED"]);
  });

  it("returns repository/provider-backed investigation facts without changing lifecycle or exposing execution",async()=>{
    const before=contexts.load("INCIDENT","INC-1001");
    const privilege=await invocations.invoke("check_privilege_changes",{subjectId:"INC-1001",expectedLifecycleVersion:before.lifecycleVersion}) as {facts:{currentPrivileges:Array<{name:string}>;privilegeEvents:Array<{summary:string}>}};
    const sessions=await invocations.invoke("get_active_sessions",{subjectId:"INC-1001",expectedLifecycleVersion:before.lifecycleVersion}) as {facts:Array<{id:string;location:string}>};
    expect(privilege.facts.currentPrivileges).toEqual(expect.arrayContaining([expect.objectContaining({name:"finance-admin"})]));
    expect(privilege.facts.privilegeEvents[0].summary).toContain("outside the normal change window");
    expect(sessions.facts).toEqual(expect.arrayContaining([expect.objectContaining({id:"SES-ASHA-SUSPICIOUS",location:"Frankfurt, DE"})]));
    const after=contexts.load("INCIDENT","INC-1001");expect(after.lifecycleVersion).toBe(before.lifecycleVersion);
    expect(after.lifecycleState).toBe(before.lifecycleState);expect(after.proposalAuthorities).toEqual(before.proposalAuthorities);
    expect((await refresh.refreshCapabilities("INCIDENT","INC-1001")).registered).not.toEqual(expect.arrayContaining(["revoke_approved_sessions","remove_approved_privilege"]));
  });

  it("refreshes only registry deltas across lifecycle and approval changes", async () => {
    const first = await refresh.refreshCapabilities("INCIDENT", "INC-1001");
    expect(first.delta.added).toHaveLength(5);
    expect(browser.tools.get("inspect_incident")?.annotations).toEqual({ readOnlyHint: true });
    const auditCountBeforeRepeat = (db.prepare("SELECT COUNT(*) AS count FROM audit_events").get() as { count: number }).count;
    const repeated = await refresh.refreshCapabilities("INCIDENT", "INC-1001");
    expect(repeated.delta).toMatchObject({ added: [], removed: [] });
    expect((db.prepare("SELECT COUNT(*) AS count FROM audit_events").get() as { count: number }).count).toBe(auditCountBeforeRepeat);

    db.prepare("UPDATE security_cases SET state = 'VALIDATED', version = 4 WHERE id = 'INC-1001'").run();
    expect((await refresh.refreshCapabilities("INCIDENT", "INC-1001")).delta.added).toEqual(["prepare_containment"]);
    expect(browser.tools.get("prepare_containment")?.annotations).toBeUndefined();

    controlPlane.saveActionProposal({ id: "ACT-REGISTRY", subjectType: "INCIDENT", subjectId: "INC-1001",
      actionType: "REVOKE_SESSIONS", parameters: { sessionIds: ["SES-ASHA-SUSPICIOUS"] },
      rationale: "Contain the suspicious session.", evidenceRefs: ["EVD-1001"], proposalVersion: 1,
      status: "PROPOSED", createdBy: "AI-REASONER", createdAt: "2026-08-27T08:00:00.000Z", updatedAt: "2026-08-27T08:00:00.000Z" });
    controlPlane.saveApprovalDecision({ id: "APR-REGISTRY", actionId: "ACT-REGISTRY", proposalVersion: 1,
      decision: "APPROVED", actorId: "analyst-1", reason: "Approved for containment.", decidedAt: "2026-08-27T08:01:00.000Z" });
    db.prepare("UPDATE security_cases SET state = 'CONTAINING', version = 5 WHERE id = 'INC-1001'").run();
    const containing = await refresh.refreshCapabilities("INCIDENT", "INC-1001");
    expect(containing.delta.added).toEqual(["revoke_approved_sessions"]);
    expect(containing.delta.removed).toEqual(["prepare_containment"]);

    db.prepare("UPDATE security_cases SET state = 'VERIFYING', version = 6 WHERE id = 'INC-1001'").run();
    const verifying = await refresh.refreshCapabilities("INCIDENT", "INC-1001");
    expect(verifying.delta.removed).toContain("revoke_approved_sessions");
    expect(verifying.delta.added).toEqual(["verify_containment", "verify_identity_state"]);
    const changeEvents = (db.prepare("SELECT details_json FROM audit_events WHERE event_type IN ('WEBMCP_TOOL_REGISTERED','WEBMCP_TOOL_UNREGISTERED')").all() as Array<{ details_json: string }>)
      .map((row) => JSON.parse(row.details_json).changeType);
    expect(changeEvents).toEqual(expect.arrayContaining(["TOOL_AVAILABLE", "TOOL_REMOVED"]));
  });

  it("rejects cross-subject evidence during containment preparation", async () => {
    db.prepare("UPDATE security_cases SET state = 'VALIDATED', version = 4 WHERE id = 'INC-1001'").run();
    await expect(invocations.invoke("prepare_containment", { subjectId: "INC-1001", expectedLifecycleVersion: 4,
      requestedActions: ["REVOKE_SESSIONS"], evidenceRefs: ["EVD-2001"] }))
      .rejects.toBeInstanceOf(InvalidEvidenceReferenceError);
    await expect(invocations.invoke("prepare_containment", { subjectId: "INC-1001", expectedLifecycleVersion: 4,
      requestedActions: ["REVOKE_SESSIONS"], evidenceRefs: [] })).rejects.toThrow();
  });

  it("invalidates approval when the same action is modified to a newer proposal version", async () => {
    controlPlane.saveActionProposal({ id: "ACT-STALE", subjectType: "INCIDENT", subjectId: "INC-1001",
      actionType: "REVOKE_SESSIONS", parameters: { sessionIds: ["SES-ASHA-SUSPICIOUS"] },
      rationale: "Version one.", evidenceRefs: ["EVD-1001"], proposalVersion: 1, status: "PROPOSED",
      createdBy: "AI-REASONER", createdAt: "2026-08-27T09:00:00.000Z", updatedAt: "2026-08-27T09:00:00.000Z" });
    controlPlane.saveApprovalDecision({ id: "APR-STALE", actionId: "ACT-STALE", proposalVersion: 1,
      decision: "APPROVED", actorId: "analyst-1", reason: null, decidedAt: "2026-08-27T09:01:00.000Z" });
    db.prepare("UPDATE security_cases SET state = 'CONTAINING', version = 4 WHERE id = 'INC-1001'").run();
    expect((await refresh.refreshCapabilities("INCIDENT", "INC-1001")).registered).toContain("revoke_approved_sessions");
    controlPlane.saveActionProposal({ id: "ACT-STALE", subjectType: "INCIDENT", subjectId: "INC-1001",
      actionType: "REVOKE_SESSIONS", parameters: { sessionIds: ["SES-ASHA-NORMAL", "SES-ASHA-SUSPICIOUS"] },
      rationale: "Modified target set.", evidenceRefs: ["EVD-1001"], proposalVersion: 2, status: "PROPOSED",
      createdBy: "analyst-1", createdAt: "2026-08-27T09:02:00.000Z", updatedAt: "2026-08-27T09:02:00.000Z" });
    await expect(invocations.invoke("revoke_approved_sessions", { subjectId: "INC-1001", expectedLifecycleVersion: 4,
      actionId: "ACT-STALE", proposalVersion: 1, idempotencyKey: "idem-stale-v1" }))
      .rejects.toBeInstanceOf(StaleProposalApprovalError);
    expect((await refresh.refreshCapabilities("INCIDENT", "INC-1001")).registered).not.toContain("revoke_approved_sessions");
  });

  it("blocks a previously discovered execution tool after authoritative lifecycle change", async () => {
    controlPlane.saveActionProposal({ id: "ACT-DISCOVERED", subjectType: "INCIDENT", subjectId: "INC-1001",
      actionType: "REVOKE_SESSIONS", parameters: { sessionIds: ["SES-ASHA-SUSPICIOUS"] },
      rationale: "Approved containment.", evidenceRefs: ["EVD-1001"], proposalVersion: 1, status: "PROPOSED",
      createdBy: "AI-REASONER", createdAt: "2026-08-27T10:00:00.000Z", updatedAt: "2026-08-27T10:00:00.000Z" });
    controlPlane.saveApprovalDecision({ id: "APR-DISCOVERED", actionId: "ACT-DISCOVERED", proposalVersion: 1,
      decision: "APPROVED", actorId: "analyst-1", reason: null, decidedAt: "2026-08-27T10:01:00.000Z" });
    db.prepare("UPDATE security_cases SET state = 'CONTAINING', version = 4 WHERE id = 'INC-1001'").run();
    await refresh.refreshCapabilities("INCIDENT", "INC-1001");
    const discovered = browser.tools.get("revoke_approved_sessions")!;
    db.prepare("UPDATE security_cases SET state = 'VERIFYING', version = 5 WHERE id = 'INC-1001'").run();
    await expect(discovered.execute({ subjectId: "INC-1001", expectedLifecycleVersion: 4,
      actionId: "ACT-DISCOVERED", proposalVersion: 1, idempotencyKey: "idem-discovered" }))
      .rejects.toBeInstanceOf(StaleCapabilityContextError);
    const blocked = db.prepare("SELECT details_json FROM audit_events WHERE event_type = 'WEBMCP_TOOL_BLOCKED' ORDER BY occurred_at DESC LIMIT 1").get() as { details_json: string };
    expect(JSON.parse(blocked.details_json)).toMatchObject({ changeType: "TOOL_LOCKED", reasonCode: "STALE_CAPABILITY_CONTEXT" });
    expect(db.prepare("SELECT COUNT(*) AS count FROM execution_records").get()).toEqual({ count: 0 });
  });

  it("returns a typed error for an unknown capability subject", () => {
    expect(() => contexts.load("INCIDENT", "INC-UNKNOWN")).toThrow(CapabilitySubjectNotFoundError);
  });
});

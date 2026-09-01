import type { CapabilityContextService } from "./capability-context.service";
import { evaluateCapabilities } from "./capability-policy";
import type { WebMcpToolName } from "./capability.types";
import type { WebMcpAuditRecorder } from "./webmcp-audit";
import type { WebMcpToolDefinition } from "./webmcp-tool.types";

export class CapabilityNotAllowedError extends Error {
  readonly code = "CAPABILITY_NOT_ALLOWED";
  constructor(readonly toolName: WebMcpToolName, readonly reasonCode: string, message: string) { super(message); }
}
export class StaleCapabilityContextError extends Error {
  readonly code = "STALE_CAPABILITY_CONTEXT";
  constructor(readonly expectedLifecycleVersion: number, readonly actualLifecycleVersion: number) {
    super(`Expected lifecycle version ${expectedLifecycleVersion}, but the authoritative version is ${actualLifecycleVersion}.`);
  }
}
export class StaleProposalApprovalError extends Error {
  readonly code = "STALE_PROPOSAL_APPROVAL";
  constructor(readonly actionId: string, readonly requestedProposalVersion: number, readonly currentProposalVersion: number) {
    super(`Approval for ${actionId} version ${requestedProposalVersion} cannot authorize current proposal version ${currentProposalVersion}.`);
  }
}

const toolMatchesAction = (toolName: WebMcpToolName, actionType: string) => actionType === "CONTAIN_IDENTITY"
  || (toolName === "revoke_approved_sessions" && actionType === "REVOKE_SESSIONS")
  || (toolName === "remove_approved_privilege" && actionType === "REMOVE_PRIVILEGE");

export class ToolInvocationService {
  constructor(private readonly contextService: CapabilityContextService,
    private readonly tools: Record<WebMcpToolName, WebMcpToolDefinition>, private readonly audit: WebMcpAuditRecorder) {}

  async invoke(toolName: WebMcpToolName, rawInput: unknown, actorId = "browser-agent"): Promise<unknown> {
    const tool = this.tools[toolName];
    const input = tool.inputSchema.parse(rawInput) as { subjectId: string; expectedLifecycleVersion: number };
    const context = this.contextService.load("INCIDENT", input.subjectId);
    if (context.lifecycleVersion !== input.expectedLifecycleVersion) {
      this.audit.record("WEBMCP_TOOL_BLOCKED", context, toolName, tool.classification,
        { changeType: "TOOL_LOCKED", reasonCode: "STALE_CAPABILITY_CONTEXT",
          expectedLifecycleVersion: input.expectedLifecycleVersion, actorId });
      throw new StaleCapabilityContextError(input.expectedLifecycleVersion, context.lifecycleVersion);
    }
    if (tool.classification === "EXECUTE") {
      const actionInput = input as typeof input & { actionId: string; proposalVersion: number; idempotencyKey: string };
      const latest = context.proposalAuthorities.find((authority) => authority.actionId === actionInput.actionId);
      if (latest && latest.proposalVersion !== actionInput.proposalVersion) {
        this.audit.record("WEBMCP_TOOL_BLOCKED", context, toolName, tool.classification,
          { changeType: "TOOL_LOCKED", reasonCode: "STALE_PROPOSAL_APPROVAL", actionId: actionInput.actionId,
            requestedProposalVersion: actionInput.proposalVersion, currentProposalVersion: latest.proposalVersion,
            idempotencyKey: actionInput.idempotencyKey, actorId });
        throw new StaleProposalApprovalError(actionInput.actionId, actionInput.proposalVersion, latest.proposalVersion);
      }
      if (!latest || latest.approvalState !== "APPROVED" || latest.proposalState !== "PROPOSED"
        || latest.executionState === "SUCCEEDED" || !toolMatchesAction(toolName, latest.actionType)) {
        this.audit.record("WEBMCP_TOOL_BLOCKED", context, toolName, tool.classification,
          { changeType: "TOOL_LOCKED", reasonCode: "EXACT_APPROVAL_REQUIRED", actionId: actionInput.actionId,
            proposalVersion: actionInput.proposalVersion, idempotencyKey: actionInput.idempotencyKey, actorId });
        throw new CapabilityNotAllowedError(toolName, "EXACT_APPROVAL_REQUIRED", "The exact latest proposal version is not approved for this execution tool.");
      }
    }
    const evaluation = evaluateCapabilities(context);
    const decision = [...evaluation.allowed, ...evaluation.locked].find((item) => item.toolName === toolName)!;
    if (!decision.allowed) {
      this.audit.record("WEBMCP_TOOL_BLOCKED", context, toolName, tool.classification,
        { changeType: "TOOL_LOCKED", reasonCode: decision.reasonCode, actorId });
      throw new CapabilityNotAllowedError(toolName, decision.reasonCode, decision.reason);
    }
    this.audit.record("WEBMCP_TOOL_CALLED", context, toolName, tool.classification, { actorId });
    try {
      const output = await tool.execute(input, { subjectId: input.subjectId,
        expectedLifecycleVersion: input.expectedLifecycleVersion, actorId });
      const parsed = tool.outputSchema.parse(output);
      this.audit.record("WEBMCP_TOOL_SUCCEEDED", context, toolName, tool.classification, { actorId });
      return parsed;
    } catch (cause) {
      this.audit.record("WEBMCP_TOOL_FAILED", context, toolName, tool.classification, { actorId,
        errorCode: cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "TOOL_EXECUTION_FAILED" });
      throw cause;
    }
  }
}

import type { CapabilityContext, CapabilityDecision, CapabilityEvaluation, WebMcpToolName } from "./capability.types";
import { TOOL_METADATA, WEBMCP_TOOL_NAMES } from "./tool-metadata";

const READ_TOOLS = new Set<WebMcpToolName>(["inspect_incident", "get_active_sessions", "get_device_context", "check_privilege_changes", "review_evidence_timeline"]);
const VERIFY_TOOLS = new Set<WebMcpToolName>(["verify_containment", "verify_identity_state"]);
const executionMatches = (tool: WebMcpToolName, actionType: string | null) => actionType === "CONTAIN_IDENTITY"
  || (tool === "revoke_approved_sessions" && actionType === "REVOKE_SESSIONS")
  || (tool === "remove_approved_privilege" && actionType === "REMOVE_PRIVILEGE");

function decide(context: CapabilityContext, toolName: WebMcpToolName): CapabilityDecision {
  const classification = TOOL_METADATA[toolName].classification;
  const locked = (reasonCode: string, reason: string): CapabilityDecision => ({ toolName, classification, allowed: false, reasonCode, reason });
  const allowed = (reasonCode: string, reason: string): CapabilityDecision => ({ toolName, classification, allowed: true, reasonCode, reason });
  if (context.subjectType !== "INCIDENT" || context.incidentOrFindingType !== "IDENTITY_SESSION_COMPROMISE") {
    return locked("WORKFLOW_NOT_SUPPORTED", "This initial tool set is limited to identity/session incidents.");
  }
  if (READ_TOOLS.has(toolName)) {
    return context.analystPermissions.includes("INVESTIGATE")
      ? allowed("INVESTIGATION_READ_ALLOWED", "Investigation reads are available for this analyst.")
      : locked("MISSING_INVESTIGATE_PERMISSION", "The analyst lacks investigation permission.");
  }
  if (toolName === "prepare_containment") {
    if (!context.analystPermissions.includes("PREPARE")) return locked("MISSING_PREPARE_PERMISSION", "The analyst lacks proposal preparation permission.");
    return context.lifecycleState === "VALIDATED"
      ? allowed("VALIDATED_CASE", "The incident is validated and containment can be prepared.")
      : locked("INCIDENT_NOT_VALIDATED", "Containment preparation requires a validated incident.");
  }
  if (classification === "EXECUTE") {
    if (!context.analystPermissions.includes("EXECUTE")) return locked("MISSING_EXECUTE_PERMISSION", "The analyst lacks containment execution permission.");
    if (context.lifecycleState !== "CONTAINING") return locked("INCIDENT_NOT_CONTAINING", "Execution tools are available only while containment is authorized and active.");
    const matching = context.proposalAuthorities.find((authority) => authority.proposalState === "PROPOSED"
      && authority.approvalState === "APPROVED" && authority.executionState !== "SUCCEEDED"
      && executionMatches(toolName, authority.actionType));
    if (matching) return allowed("APPROVED_ACTION_EXECUTABLE", "The exact latest approved proposal authorizes this bounded execution tool.");
    const alreadySucceeded = context.proposalAuthorities.some((authority) => authority.approvalState === "APPROVED"
      && authority.executionState === "SUCCEEDED" && executionMatches(toolName, authority.actionType));
    if (alreadySucceeded) return locked("ACTION_ALREADY_SUCCEEDED", "The approved action already succeeded and cannot be executed again.");
    const hasMatchingAction = context.proposalAuthorities.some((authority) => executionMatches(toolName, authority.actionType));
    return hasMatchingAction
      ? locked("EXACT_APPROVAL_REQUIRED", "An approval for the exact latest proposal version is required.")
      : locked("ACTION_TYPE_MISMATCH", "No exact approved proposal authorizes this execution tool.");
  }
  if (VERIFY_TOOLS.has(toolName)) {
    if (!context.analystPermissions.includes("VERIFY")) return locked("MISSING_VERIFY_PERMISSION", "The analyst lacks verification permission.");
    return context.lifecycleState === "CONTAINED" || context.lifecycleState === "VERIFYING"
      ? allowed("CONTAINMENT_READY_FOR_VERIFICATION", "Containment has completed and identity state can be verified.")
      : locked("INCIDENT_NOT_READY_FOR_VERIFICATION", "Verification requires a contained or verifying incident.");
  }
  return locked("TOOL_NOT_ALLOWED", "The tool is not allowed in the current capability context.");
}

export function evaluateCapabilities(context: CapabilityContext): CapabilityEvaluation {
  const decisions = WEBMCP_TOOL_NAMES.map((tool) => decide(context, tool));
  return { allowed: decisions.filter((decision) => decision.allowed), locked: decisions.filter((decision) => !decision.allowed) };
}

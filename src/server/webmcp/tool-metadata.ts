import type { ToolClassification, WebMcpToolName } from "./capability.types";

export const TOOL_METADATA: Record<WebMcpToolName, { classification: ToolClassification; description: string }> = {
  inspect_incident: { classification: "READ", description: "Read the current incident before deciding what to investigate." },
  get_active_sessions: { classification: "READ", description: "List active sessions for the identity affected by the incident." },
  get_device_context: { classification: "READ", description: "Read trust and location facts for a device related to the incident." },
  check_privilege_changes: { classification: "READ", description: "Review current privileges and recorded privilege-change events." },
  review_evidence_timeline: { classification: "READ", description: "Read ordered security events and evidence for the incident." },
  prepare_containment: { classification: "PREPARE", description: "Prepare a bounded containment proposal for analyst review." },
  revoke_approved_sessions: { classification: "EXECUTE", description: "Revoke only sessions included in the analyst-approved action." },
  remove_approved_privilege: { classification: "EXECUTE", description: "Remove only privileges included in the analyst-approved action." },
  verify_containment: { classification: "VERIFY", description: "Check whether the approved containment outcome is observable." },
  verify_identity_state: { classification: "VERIFY", description: "Read the current identity, session, and privilege state after containment." },
};
export const WEBMCP_TOOL_NAMES = Object.keys(TOOL_METADATA) as WebMcpToolName[];

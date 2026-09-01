export interface DemoSystemPresentation {
  id: "elastic" | "auth0";
  name: string;
  purpose: string;
  contributions: readonly string[];
  accent: "evidence" | "identity";
  status: "Connected";
  statusBasis: "REFERENCE_CONFIGURATION_NOT_HEALTH_CHECKED";
}

// Demo-only presentation metadata. There is no provider-health endpoint today;
// "Connected" describes the selected reference setup and is not a live probe.
export const REFERENCE_SYSTEMS: readonly DemoSystemPresentation[] = [
  { id:"elastic", name:"Elastic / SIEM", purpose:"Provides security evidence", accent:"evidence",
    status:"Connected", statusBasis:"REFERENCE_CONFIGURATION_NOT_HEALTH_CHECKED",
    contributions:["Login events","MFA anomalies","Privilege changes","Activity timeline"] },
  { id:"auth0", name:"Auth0", purpose:"Provides identity state and actions", accent:"identity",
    status:"Connected", statusBasis:"REFERENCE_CONFIGURATION_NOT_HEALTH_CHECKED",
    contributions:["Active sessions","Current roles / privileges","Identity context","State verification target"] },
] as const;

export const INITIAL_CAPABILITIES = [
  { name:"inspect_incident", description:"Get incident summary and severity", icon:"incident" },
  { name:"get_active_sessions", description:"List active identity sessions", icon:"sessions" },
  { name:"get_device_context", description:"Retrieve device and location context", icon:"device" },
  { name:"check_privilege_changes", description:"Check recent role / privilege changes", icon:"privilege" },
  { name:"review_evidence_timeline", description:"View event timeline and evidence", icon:"timeline" },
] as const;

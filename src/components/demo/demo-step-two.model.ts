export const DEMO_SCENARIO = {
  incidentId: "INC-1001",
  affectedUser: { label:"Affected user", name:"Asha Mehta", accent:"teal" as const, facts:[
    "Identity: IDN-ASHA", "Suspicious session: SES-ASHA-SUSPICIOUS", "finance-admin privilege active",
  ]},
  reviewer: { label:"Human reviewer", name:"Kavya", accent:"purple" as const, facts:[
    "Security analyst: analyst-kavya", "Can review, approve, reject, or modify", "Human decision required before sensitive execution",
  ]},
  agent: { label:"External agent", name:"WebMCP Agent", accent:"blue" as const, facts:[
    "Discovers tools from the live page", "Invokes only currently exposed capabilities", "Reacts as the capability surface changes",
    "Cannot bypass approval", "Cannot make a stale capability valid",
  ]},
  conditions: [
    "Unfamiliar high-risk login from Frankfurt", "Three failed MFA challenges", "finance-admin granted outside the change window",
    "Unfamiliar session reached a critical finance resource",
  ],
} as const;

export const GOLDEN_PATH = [
  { kind:"tool" as const, name:"inspect_incident" },
  { kind:"tool" as const, name:"check_privilege_changes" },
  { kind:"tool" as const, name:"prepare_containment" },
  { kind:"human" as const, name:"Exact human approval" },
  { kind:"tool" as const, name:"remove_approved_privilege" },
  { kind:"tool" as const, name:"verify_identity_state" },
] as const;

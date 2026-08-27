import type { CaseState, LifecycleCommand } from "./lifecycle.types";

export const LIFECYCLE_TRANSITIONS = {
  START_TRIAGE: { from: "NEW", to: "TRIAGE" },
  START_INVESTIGATION: { from: "TRIAGE", to: "INVESTIGATING" },
  VALIDATE_CASE: { from: "INVESTIGATING", to: "VALIDATED" },
  PREPARE_RESPONSE: { from: "VALIDATED", to: "RESPONSE_PREPARED" },
  REQUEST_APPROVAL: { from: "RESPONSE_PREPARED", to: "AWAITING_APPROVAL" },
  START_CONTAINMENT: { from: "AWAITING_APPROVAL", to: "CONTAINING" },
  MARK_CONTAINED: { from: "CONTAINING", to: "CONTAINED" },
  START_VERIFICATION: { from: "CONTAINED", to: "VERIFYING" },
  MARK_RECOVERED: { from: "VERIFYING", to: "RECOVERED" },
  CLOSE_CASE: { from: "RECOVERED", to: "CLOSED" },
} as const satisfies Record<LifecycleCommand, { from: CaseState; to: CaseState }>;

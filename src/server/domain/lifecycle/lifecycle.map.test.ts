import { describe, expect, it } from "vitest";
import { LIFECYCLE_TRANSITIONS } from "./lifecycle.map";

describe("LIFECYCLE_TRANSITIONS", () => {
  it("defines the complete linear Day 1 lifecycle", () => {
    expect(Object.values(LIFECYCLE_TRANSITIONS)).toEqual([
      { from: "NEW", to: "TRIAGE" },
      { from: "TRIAGE", to: "INVESTIGATING" },
      { from: "INVESTIGATING", to: "VALIDATED" },
      { from: "VALIDATED", to: "RESPONSE_PREPARED" },
      { from: "RESPONSE_PREPARED", to: "AWAITING_APPROVAL" },
      { from: "AWAITING_APPROVAL", to: "CONTAINING" },
      { from: "CONTAINING", to: "CONTAINED" },
      { from: "CONTAINED", to: "VERIFYING" },
      { from: "VERIFYING", to: "RECOVERED" },
      { from: "RECOVERED", to: "CLOSED" },
    ]);
  });
});

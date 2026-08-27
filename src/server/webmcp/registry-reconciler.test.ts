import { describe, expect, it } from "vitest";
import { reconcileToolNames } from "./registry-reconciler";

describe("reconcileToolNames", () => {
  it("reports added, retained, and removed tools", () => {
    expect(reconcileToolNames(["inspect_incident", "prepare_containment"],
      ["inspect_incident", "verify_containment"])).toEqual({
      added: ["verify_containment"], retained: ["inspect_incident"], removed: ["prepare_containment"],
    });
  });
  it("is idempotent for an unchanged desired set", () => {
    expect(reconcileToolNames(["inspect_incident"], ["inspect_incident"])).toEqual({
      added: [], retained: ["inspect_incident"], removed: [],
    });
  });
});

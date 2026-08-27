import { describe, expect, it } from "vitest";
import { LifecyclePreconditionFailedError, StaleCaseVersionError } from "../domain/lifecycle/lifecycle.errors";
import { apiError } from "./api-errors";

describe("apiError", () => {
  it("maps optimistic concurrency failures to a structured HTTP 409", async () => {
    const response = apiError(new StaleCaseVersionError("case-1", 1, 2));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: {
      code: "STALE_CASE_VERSION",
      message: "Expected case version 1, but the current version is 2.",
      caseId: "case-1",
      expectedVersion: 1,
      actualVersion: 2,
    } });
  });

  it("maps transition precondition failures to a structured HTTP 409", async () => {
    const response = apiError(new LifecyclePreconditionFailedError("case-1", "NEW", "TRIAGE"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: {
      code: "LIFECYCLE_PRECONDITION_FAILED",
      message: "Expected case state NEW, but the current state is TRIAGE.",
      caseId: "case-1",
      expectedState: "NEW",
      actualState: "TRIAGE",
    } });
  });
});

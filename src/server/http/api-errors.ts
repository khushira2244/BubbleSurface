import { NextResponse } from "next/server";
import { z } from "zod";
import { CaseNotFoundError, InvalidLifecycleTransitionError, LifecyclePreconditionFailedError, StaleCaseVersionError } from "../domain/lifecycle/lifecycle.errors";

export function apiError(error: unknown): NextResponse {
  if (error instanceof StaleCaseVersionError) return NextResponse.json({ error: {
    code: error.code, message: error.message, caseId: error.caseId,
    expectedVersion: error.expectedVersion, actualVersion: error.actualVersion,
  } }, { status: 409 });
  if (error instanceof InvalidLifecycleTransitionError) return NextResponse.json({ error: {
    code: error.code, message: error.message, command: error.command,
    currentState: error.currentState, requiredState: error.requiredState,
  } }, { status: 409 });
  if (error instanceof LifecyclePreconditionFailedError) return NextResponse.json({ error: {
    code: error.code, message: error.message, caseId: error.caseId,
    expectedState: error.expectedState, actualState: error.actualState,
  } }, { status: 409 });
  if (error instanceof CaseNotFoundError) return NextResponse.json({ error: {
    code: error.code, message: error.message,
  } }, { status: 404 });
  if (error instanceof z.ZodError) return NextResponse.json({ error: {
    code: "VALIDATION_ERROR", message: "Request data is invalid.", issues: error.issues,
  } }, { status: 400 });
  return NextResponse.json({ error: {
    code: "INTERNAL_ERROR", message: "The request could not be completed.",
  } }, { status: 500 });
}

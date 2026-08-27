import type { CaseState, LifecycleCommand } from "./lifecycle.types";

export class CaseNotFoundError extends Error {
  readonly code = "CASE_NOT_FOUND";
  constructor(readonly caseId: string) { super(`Case ${caseId} was not found.`); }
}

export class StaleCaseVersionError extends Error {
  readonly code = "STALE_CASE_VERSION";
  constructor(readonly caseId: string, readonly expectedVersion: number, readonly actualVersion: number) {
    super(`Expected case version ${expectedVersion}, but the current version is ${actualVersion}.`);
  }
}

export class InvalidLifecycleTransitionError extends Error {
  readonly code = "INVALID_LIFECYCLE_TRANSITION";
  constructor(readonly command: LifecycleCommand, readonly currentState: CaseState, readonly requiredState: CaseState) {
    super(`${command} requires ${requiredState}; the case is currently ${currentState}.`);
  }
}

export class LifecyclePreconditionFailedError extends Error {
  readonly code = "LIFECYCLE_PRECONDITION_FAILED";
  constructor(
    readonly caseId: string,
    readonly expectedState: CaseState,
    readonly actualState: CaseState,
  ) {
    super(`Expected case state ${expectedState}, but the current state is ${actualState}.`);
  }
}

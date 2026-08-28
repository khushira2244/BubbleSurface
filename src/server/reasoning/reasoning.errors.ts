export class ReasoningError extends Error {
  constructor(readonly code: string, message: string, readonly httpStatus: number) { super(message); }
}
export class EmptyReasoningEvidenceError extends ReasoningError {
  constructor() { super("INSUFFICIENT_EVIDENCE", "The incident has no evidence suitable for reasoning.", 422); }
}
export class MalformedReasoningOutputError extends ReasoningError {
  constructor() { super("MALFORMED_REASONING_OUTPUT", "The model returned an invalid structured assessment.", 502); }
}
export class UnsupportedReasoningActionError extends ReasoningError {
  constructor(message: string) { super("UNSUPPORTED_PROPOSED_ACTION", message, 422); }
}
export class StaleReasoningLifecycleError extends ReasoningError {
  constructor(readonly expectedVersion: number, readonly actualVersion: number) {
    super("STALE_REASONING_LIFECYCLE", `Incident changed from version ${expectedVersion} to ${actualVersion} during reasoning.`, 409);
  }
}
export class ReasoningProviderError extends ReasoningError {
  constructor(code = "REASONING_PROVIDER_FAILURE", message = "The reasoning provider request failed.") { super(code, message, 502); }
}

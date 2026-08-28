export class ExecutionError extends Error{constructor(readonly code:string,message:string,readonly httpStatus=409){super(message);}}
export class ExecutionStaleLifecycleError extends ExecutionError{constructor(){super("STALE_EXECUTION_LIFECYCLE","The lifecycle version is stale.");}}
export class ExecutionStaleProposalError extends ExecutionError{constructor(){super("STALE_EXECUTION_PROPOSAL","The proposal version is no longer current.");}}
export class ExactApprovalRequiredError extends ExecutionError{constructor(){super("EXACT_APPROVAL_REQUIRED","The exact current proposal is not approved.");}}
export class ExecutionPermissionError extends ExecutionError{constructor(){super("EXECUTE_PERMISSION_REQUIRED","The actor lacks EXECUTE permission.",403);}}
export class IdempotencyConflictError extends ExecutionError{constructor(){super("IDEMPOTENCY_CONFLICT","The idempotency key was used for incompatible execution input.");}}

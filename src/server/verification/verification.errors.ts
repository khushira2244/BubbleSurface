export class VerificationError extends Error{constructor(readonly code:string,message:string,readonly httpStatus=409){super(message);}}
export class StaleVerificationLifecycleError extends VerificationError{constructor(){super("STALE_VERIFICATION_LIFECYCLE","The lifecycle version is stale.");}}
export class VerificationPermissionError extends VerificationError{constructor(){super("VERIFY_PERMISSION_REQUIRED","The actor lacks VERIFY permission.",403);}}
export class VerificationAuthorityError extends VerificationError{constructor(message:string){super("VERIFICATION_AUTHORITY_REQUIRED",message);}}

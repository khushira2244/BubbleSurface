export class ProposalReviewError extends Error {
  constructor(readonly code: string, message: string, readonly httpStatus: number) { super(message); }
}
export class ProposalNotFoundError extends ProposalReviewError { constructor() { super("PROPOSAL_NOT_FOUND", "The requested action proposal was not found.", 404); } }
export class StaleProposalVersionError extends ProposalReviewError { constructor() { super("STALE_PROPOSAL_VERSION", "Only the latest proposal version may be reviewed.", 409); } }
export class StaleReviewLifecycleError extends ProposalReviewError { constructor() { super("STALE_LIFECYCLE_VERSION", "The incident lifecycle version changed before review.", 409); } }
export class ReviewPermissionDeniedError extends ProposalReviewError { constructor() { super("APPROVE_PERMISSION_REQUIRED", "The analyst lacks APPROVE permission.", 403); } }
export class ProposalReviewBlockedError extends ProposalReviewError { constructor(message: string) { super("PROPOSAL_REVIEW_BLOCKED", message, 409); } }

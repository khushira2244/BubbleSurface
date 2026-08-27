import type { SecurityContextRepository } from "../security/security.repository";

export class InvalidEvidenceReferenceError extends Error {
  readonly code = "INVALID_EVIDENCE_REFERENCE";
  constructor(readonly subjectType: "INCIDENT" | "FINDING", readonly subjectId: string, readonly invalidEvidenceRefs: string[]) {
    super(`Evidence references are not valid for ${subjectType} ${subjectId}: ${invalidEvidenceRefs.join(", ")}.`);
  }
}

export class EvidenceReferenceValidator {
  constructor(private readonly security: SecurityContextRepository) {}
  validate(subjectType: "INCIDENT" | "FINDING", subjectId: string, evidenceRefs: string[]): void {
    const allowed = new Set(this.security.getEvidenceForSubject(subjectType, subjectId).map((evidence) => evidence.id));
    const invalid = [...new Set(evidenceRefs.filter((reference) => !allowed.has(reference)))];
    if (invalid.length) throw new InvalidEvidenceReferenceError(subjectType, subjectId, invalid);
  }
}

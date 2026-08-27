import type { CapabilityContextRepository } from "./capability-context.repository";

export class CapabilitySubjectNotFoundError extends Error {
  readonly code = "CAPABILITY_SUBJECT_NOT_FOUND";
  constructor(subjectType: string, subjectId: string) { super(`${subjectType} ${subjectId} was not found.`); }
}
export class CapabilityContextService {
  constructor(private readonly repository: CapabilityContextRepository) {}
  load(subjectType: "INCIDENT" | "FINDING", subjectId: string) {
    const context = this.repository.derive(subjectType, subjectId);
    if (!context) throw new CapabilitySubjectNotFoundError(subjectType, subjectId);
    return context;
  }
}

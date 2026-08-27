import type { CaseState, CaseType, LifecycleCommand, LifecycleEvent, SecurityCase } from "./lifecycle.types";

export interface CreateCaseInput { id: string; type: CaseType; title: string }
export interface TransitionCaseInput {
  caseId: string; caseType: CaseType; expectedVersion: number;
  fromState: CaseState; toState: CaseState; command: LifecycleCommand;
  actorId: string; occurredAt: string;
}
export interface CaseRepository {
  create(input: CreateCaseInput): SecurityCase;
  findById(caseId: string, caseType: CaseType): SecurityCase | null;
  transition(input: TransitionCaseInput): { case: SecurityCase; event: LifecycleEvent };
}

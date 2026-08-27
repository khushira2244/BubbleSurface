import { randomUUID } from "node:crypto";
import { InvalidLifecycleTransitionError, StaleCaseVersionError } from "./lifecycle.errors";
import { LIFECYCLE_TRANSITIONS } from "./lifecycle.map";
import type { CaseRepository } from "./lifecycle.repository";
import type { CaseType, LifecycleCommand, SecurityCase } from "./lifecycle.types";

export interface ExecuteLifecycleCommandInput {
  caseId: string;
  caseType: CaseType;
  command: LifecycleCommand;
  expectedVersion: number;
  actorId: string;
}

export class LifecycleService {
  constructor(private readonly cases: CaseRepository) {}

  createCase(type: CaseType, title: string): SecurityCase {
    return this.cases.create({ id: randomUUID(), type, title });
  }

  execute(input: ExecuteLifecycleCommandInput): SecurityCase {
    const transition = LIFECYCLE_TRANSITIONS[input.command];
    const current = this.cases.findById(input.caseId, input.caseType);
    if (current && current.version !== input.expectedVersion) {
      throw new StaleCaseVersionError(input.caseId, input.expectedVersion, current.version);
    }
    if (current && current.state !== transition.from) {
      throw new InvalidLifecycleTransitionError(input.command, current.state, transition.from);
    }
    return this.cases.transition({
      ...input,
      fromState: transition.from,
      toState: transition.to,
      occurredAt: new Date().toISOString(),
    }).case;
  }
}

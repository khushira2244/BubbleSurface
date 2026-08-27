import { z } from "zod";

export const caseStateSchema = z.enum([
  "NEW",
  "TRIAGE",
  "INVESTIGATING",
  "VALIDATED",
  "RESPONSE_PREPARED",
  "AWAITING_APPROVAL",
  "CONTAINING",
  "CONTAINED",
  "VERIFYING",
  "RECOVERED",
  "CLOSED",
]);

export const caseTypeSchema = z.enum(["INCIDENT", "VULNERABILITY_FINDING"]);

export type CaseState = z.infer<typeof caseStateSchema>;
export type CaseType = z.infer<typeof caseTypeSchema>;

export const lifecycleCommandSchema = z.enum([
  "START_TRIAGE",
  "START_INVESTIGATION",
  "VALIDATE_CASE",
  "PREPARE_RESPONSE",
  "REQUEST_APPROVAL",
  "START_CONTAINMENT",
  "MARK_CONTAINED",
  "START_VERIFICATION",
  "MARK_RECOVERED",
  "CLOSE_CASE",
]);

export type LifecycleCommand = z.infer<typeof lifecycleCommandSchema>;

export interface SecurityCase {
  id: string;
  type: CaseType;
  title: string;
  state: CaseState;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleEvent {
  id: string;
  caseId: string;
  caseType: CaseType;
  command: LifecycleCommand;
  fromState: CaseState;
  toState: CaseState;
  fromVersion: number;
  toVersion: number;
  actorId: string;
  occurredAt: string;
}

import type { HumanSurfaceActivity, HumanSurfaceExecution, HumanSurfaceModel, HumanSurfaceProposal,
  HumanSurfaceStatus, HumanSurfaceSubject, HumanSurfaceVerification } from "./human-surface.types";

export function deriveHumanSurfaceStatus(input: Pick<HumanSurfaceModel, "proposal" | "execution" | "verification" | "activity">): HumanSurfaceStatus {
  const { proposal, execution, verification } = input;
  if (proposal?.staleReason) return "STALE";
  if (proposal?.proposalState === "SUPERSEDED") return "SUPERSEDED";
  if (verification.state === "FAILED") return "VERIFICATION_FAILED";
  if (verification.state === "PASSED") return "VERIFIED";
  if (verification.state === "VERIFYING") return "VERIFYING";
  if (execution.state === "FAILED" || execution.state === "UNKNOWN") return "EXECUTION_FAILED";
  if (execution.state === "IN_PROGRESS" || execution.state === "PENDING") return "EXECUTING";
  if (execution.state === "SUCCEEDED") return "EXECUTION_SUCCEEDED";
  if (proposal?.approvalState === "REJECTED") return "REJECTED";
  if (proposal?.approvalState === "APPROVED") return "APPROVED";
  if (proposal?.reviewable) return "HUMAN_REVIEW_REQUIRED";
  return input.activity.some((event) => event.actorType === "AGENT") ? "AGENT_ACTIVE" : "IDLE";
}

type RawProposal = Record<string, unknown>;
type RawExecution = Record<string, unknown>;
type RawVerification = Record<string, unknown>;
const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const optionalText = (value: unknown) => typeof value === "string" && value.length ? value : undefined;
const number = (value: unknown, fallback = 1) => typeof value === "number" ? value : fallback;
const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function mapControlPlaneToHumanSurface(input: { subject: HumanSurfaceSubject; action: RawProposal;
  executions?: RawExecution[]; verifications?: RawVerification[]; activity?: HumanSurfaceActivity[] }): HumanSurfaceModel {
  const latest = record(input.action.latest);
  const currentVersion = number(input.action.currentVersion, number(latest.proposalVersion));
  const proposalVersion = number(latest.proposalVersion, currentVersion);
  const proposalState = text(latest.proposalState, text(latest.status, "PROPOSED")) as HumanSurfaceProposal["proposalState"];
  const approvalState = text(latest.approvalState, "NONE") as HumanSurfaceProposal["approvalState"];
  const reviewState = text(latest.reviewState, "PENDING_REVIEW");
  const proposal: HumanSurfaceProposal = {
    actionId: text(input.action.actionId, text(latest.id)), actionType: text(latest.actionType, "ACTION"),
    actionDescription: text(latest.actionDescription, text(latest.actionType, "Proposed consequential action").replaceAll("_", " ").toLowerCase()),
    rationale: text(latest.rationale, "No justification was supplied."), version: proposalVersion,
    lifecycleVersion: number(latest.lifecycleVersion, number(record(latest.parameters).lifecycleVersion)),
    proposalState, approvalState, parameters: record(latest.parameters), metadata: record(latest.metadata),
    reviewable: proposalState === "PROPOSED" && approvalState === "NONE" && reviewState === "PENDING_REVIEW" && proposalVersion === currentVersion,
    ...(proposalVersion !== currentVersion ? { staleReason: `Proposal v${proposalVersion} is not the latest version.` } : {}),
  };
  const executionRow = input.executions?.at(-1);
  const execution: HumanSurfaceExecution = { state: text(executionRow?.status, "NONE") as HumanSurfaceExecution["state"],
    startedAt: executionRow?.startedAt as string | null | undefined, completedAt: executionRow?.completedAt as string | null | undefined,
    message: optionalText(record(executionRow?.error).message) };
  const verificationRows = input.verifications ?? [];
  const checks = verificationRows.map((value) => ({ name: text(value.verificationType, "Verification"),
    passed: value.success === true || value.status === "PASSED", checkedAt: optionalText(value.checkedAt) }));
  const anyFailed = checks.some((check) => !check.passed), allPassed = checks.length > 0 && checks.every((check) => check.passed);
  const verification: HumanSurfaceVerification = { state: anyFailed ? "FAILED" : allPassed ? "PASSED"
    : execution.state === "SUCCEEDED" ? "PENDING" : "NONE", checks };
  const activity = input.activity ?? buildActivity(proposal, execution, verification, latest);
  const model = { subject: input.subject, proposal, execution, verification, activity,
    updatedAt: new Date().toISOString(), status: "IDLE" as HumanSurfaceStatus };
  model.status = deriveHumanSurfaceStatus(model);
  return model;
}

function buildActivity(proposal: HumanSurfaceProposal, execution: HumanSurfaceExecution,
  verification: HumanSurfaceVerification, raw: RawProposal): HumanSurfaceActivity[] {
  const events: HumanSurfaceActivity[] = [{ id: `proposal-${proposal.actionId}-${proposal.version}`, actorType: "AGENT",
    label: `Proposed ${proposal.actionDescription}`, detail: `Proposal v${proposal.version}`, occurredAt: text(raw.createdAt, new Date().toISOString()) }];
  if (proposal.approvalState !== "NONE") events.push({ id: `decision-${proposal.actionId}-${proposal.version}`, actorType: "HUMAN",
    label: `${proposal.approvalState.toLowerCase()} proposal v${proposal.version}`, occurredAt: text(raw.updatedAt, events[0].occurredAt) });
  if (execution.state !== "NONE") events.push({ id: `execution-${proposal.actionId}`, actorType: "SYSTEM",
    label: `Execution ${execution.state.toLowerCase().replaceAll("_", " ")}`, occurredAt: execution.completedAt ?? execution.startedAt ?? events.at(-1)!.occurredAt });
  for (const [index, check] of verification.checks.entries()) events.push({ id: `verification-${index}-${proposal.actionId}`, actorType: "SYSTEM",
    label: `${check.name}: ${check.passed ? "passed" : "failed"}`, occurredAt: check.checkedAt ?? events.at(-1)!.occurredAt });
  return events;
}

"use client";

import type { ApprovalClient, ApprovalMutation } from "@/server/webmcp/integration-contracts";
import { mapControlPlaneToHumanSurface } from "./human-surface.viewmodel";
import type { HumanSurfaceModel, HumanSurfaceSubject } from "./human-surface.types";

async function responseJson(response: Response): Promise<unknown> {
  const body = await response.json();
  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : null;
    const message = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message)
      : "The review request could not be completed.";
    throw new HumanSurfaceClientError(message, response.status);
  }
  return body;
}
export class HumanSurfaceClientError extends Error { constructor(message: string, readonly status: number) { super(message); } }

export class HttpHumanSurfaceClient implements ApprovalClient {
  constructor(private readonly baseUrl = "") {}
  list(subjectId: string) { return this.get(`/api/incidents/${encodeURIComponent(subjectId)}/proposals`); }
  read(actionId: string) { return this.get(`/api/actions/${encodeURIComponent(actionId)}`); }
  approve(input: ApprovalMutation) { return this.mutate(input.actionId, "approve", input); }
  reject(input: ApprovalMutation) { return this.mutate(input.actionId, "reject", input); }
  modify(input: ApprovalMutation & { parameters?: Record<string, unknown>; rationale?: string }) {
    return this.mutate(input.actionId, "modify", input);
  }
  async loadModel(subject: HumanSurfaceSubject, actionId: string): Promise<HumanSurfaceModel> {
    const [action, execution, verification] = await Promise.all([this.read(actionId),
      this.get(`/api/actions/${encodeURIComponent(actionId)}/executions`),
      this.get(`/api/actions/${encodeURIComponent(actionId)}/verifications`)]);
    return mapControlPlaneToHumanSurface({ subject, action: action as Record<string, unknown>,
      executions: ((execution as { executions?: Record<string, unknown>[] }).executions ?? []),
      verifications: ((verification as { verifications?: Record<string, unknown>[] }).verifications ?? []) });
  }
  async loadLatestModel(subject: HumanSurfaceSubject): Promise<HumanSurfaceModel | null> {
    const listed=await this.list(subject.id) as {actions?:Array<Record<string,unknown>>};
    const actions=listed.actions??[];
    if(!actions.length)return null;
    const latest=actions.at(-1)!;
    const actionId=String(latest.actionId??"");
    return actionId?this.loadModel(subject,actionId):null;
  }
  private async get(path: string) { return responseJson(await fetch(`${this.baseUrl}${path}`, { cache: "no-store" })); }
  private async mutate(actionId: string, kind: string,
    input: ApprovalMutation & { parameters?: Record<string, unknown>; rationale?: string }) {
    const { actionId: _routeActionId, ...body } = input;
    return responseJson(await fetch(`${this.baseUrl}/api/actions/${encodeURIComponent(actionId)}/${kind}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }));
  }
}

export class HumanReviewController {
  constructor(private readonly approvals: ApprovalClient, private readonly reload: () => Promise<HumanSurfaceModel>) {}
  approve(input: ApprovalMutation) { return this.mutate(() => this.approvals.approve(input)); }
  reject(input: ApprovalMutation) { return this.mutate(() => this.approvals.reject(input)); }
  modify(input: ApprovalMutation & { parameters?: Record<string, unknown>; rationale?: string }) {
    return this.mutate(() => this.approvals.modify(input));
  }
  private async mutate(operation: () => Promise<unknown> | unknown) { await operation(); return this.reload(); }
}

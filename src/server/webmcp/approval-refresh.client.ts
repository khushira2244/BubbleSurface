"use client";

import type { ApprovalClient } from "./integration-contracts";

export interface CapabilityRefreshTarget { refresh(): Promise<unknown> }

/** UI-neutral approval client decorator: successful mutations immediately reconcile WebMCP capabilities. */
export class RefreshingApprovalClient implements ApprovalClient {
  constructor(private readonly approvals: ApprovalClient, private readonly capabilities: CapabilityRefreshTarget) {}
  list(subjectId: string) { return this.approvals.list(subjectId); }
  read(actionId: string) { return this.approvals.read(actionId); }
  async approve(input: Parameters<ApprovalClient["approve"]>[0]) {
    const result = await this.approvals.approve(input); await this.capabilities.refresh(); return result;
  }
  async reject(input: Parameters<ApprovalClient["reject"]>[0]) {
    const result = await this.approvals.reject(input); await this.capabilities.refresh(); return result;
  }
  async modify(input: Parameters<ApprovalClient["modify"]>[0]) {
    const result = await this.approvals.modify(input); await this.capabilities.refresh(); return result;
  }
}

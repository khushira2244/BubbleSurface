import type { BrowserToolRegistration, WebMcpToolDefinition } from "./webmcp-tool.types";

export interface CapabilitySubject { type: string; id: string; category?: string }
export interface ResolvedPrincipal {
  id: string; type: "HUMAN" | "AGENT" | "SERVICE" | "SYSTEM";
  permissions: readonly string[]; roles?: readonly string[];
  context?: { tenantId?: string; workspaceId?: string };
}
export interface PrincipalResolver<TRequestContext = unknown> {
  resolve(requestContext: TRequestContext): ResolvedPrincipal | Promise<ResolvedPrincipal>;
}
export interface AuthoritativeState { subject: CapabilitySubject; version: number; state: string; actor: ResolvedPrincipal }

export interface AuthoritativeStateProvider<TState extends AuthoritativeState> {
  load(subject: CapabilitySubject, principal: ResolvedPrincipal): TState | Promise<TState>;
}
export interface CapabilityPolicy<TState extends AuthoritativeState> {
  evaluate(state: TState, descriptor: WebMcpToolDefinition): { allowed: boolean; reasonCode: string; reason: string };
}
export interface CapabilitySnapshotTransport {
  getCapabilities(subject: CapabilitySubject, signal?: AbortSignal): Promise<{
    context: { subjectId: string; lifecycleVersion: number };
    tools: Array<Omit<BrowserToolRegistration, "execute">>;
  }>;
  invoke(capabilityId: string, input: unknown, signal?: AbortSignal): Promise<unknown>;
}

export interface ApprovalReadClient {
  list(subjectId: string): unknown | Promise<unknown>;
  read(actionId: string): unknown | Promise<unknown>;
}
export interface ApprovalMutation { actionId: string; proposalVersion: number; expectedLifecycleVersion: number; comment?: string }
export interface ApprovalClient extends ApprovalReadClient {
  approve(input: ApprovalMutation): unknown | Promise<unknown>;
  reject(input: ApprovalMutation): unknown | Promise<unknown>;
  modify(input: ApprovalMutation & { parameters?: Record<string, unknown>; rationale?: string }): unknown | Promise<unknown>;
}
export interface ServerApprovalIntegration extends ApprovalReadClient {
  approve(input: ApprovalMutation, principal: ResolvedPrincipal): unknown | Promise<unknown>;
  reject(input: ApprovalMutation, principal: ResolvedPrincipal): unknown | Promise<unknown>;
  modify(input: ApprovalMutation & { parameters?: Record<string, unknown>; rationale?: string }, principal: ResolvedPrincipal): unknown | Promise<unknown>;
}

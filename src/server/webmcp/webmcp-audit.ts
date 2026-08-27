import { randomUUID } from "node:crypto";
import type { ControlPlaneService } from "../domain/control-plane/control-plane.service";
import type { CapabilityContext, ToolClassification, WebMcpToolName } from "./capability.types";

export type WebMcpAuditEventType = "WEBMCP_TOOL_REGISTERED" | "WEBMCP_TOOL_UNREGISTERED" | "WEBMCP_TOOL_CALLED" | "WEBMCP_TOOL_BLOCKED";
export interface WebMcpAuditRecorder {
  record(type: WebMcpAuditEventType, context: CapabilityContext, toolName: WebMcpToolName,
    classification: ToolClassification, metadata?: Record<string, unknown>): void;
}
export class ControlPlaneWebMcpAuditRecorder implements WebMcpAuditRecorder {
  constructor(private readonly controlPlane: ControlPlaneService) {}
  record(type: WebMcpAuditEventType, context: CapabilityContext, toolName: WebMcpToolName,
    classification: ToolClassification, metadata: Record<string, unknown> = {}): void {
    this.controlPlane.appendAuditEvent({
      id: randomUUID(), subjectType: context.subjectType, subjectId: context.subjectId,
      actorType: "WEBMCP", actorId: null, eventType: type, actionId: context.proposalActionId,
      proposalVersion: context.proposalVersion, executionId: null, lifecycleVersion: context.lifecycleVersion,
      source: "browser-webmcp", metadata: { toolName, classification, ...metadata },
      occurredAt: new Date().toISOString(),
    });
  }
}

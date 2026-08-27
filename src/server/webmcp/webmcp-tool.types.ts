import type { ZodType } from "zod";
import type { ToolClassification, WebMcpToolName } from "./capability.types";

export interface ToolExecutionContext { subjectId: string; expectedLifecycleVersion: number; actorId: string }
export interface WebMcpToolDefinition {
  name: WebMcpToolName; description: string; classification: ToolClassification;
  inputSchema: ZodType; outputSchema: ZodType;
  execute(input: unknown, context: ToolExecutionContext): Promise<unknown> | unknown;
}
export interface BrowserToolRegistration {
  name: string; description: string; inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown> | unknown;
}

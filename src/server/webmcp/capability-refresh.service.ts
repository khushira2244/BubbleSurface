import { z } from "zod";
import type { BrowserWebMcpAdapter } from "./browser-webmcp.adapter";
import type { CapabilityContextService } from "./capability-context.service";
import { evaluateCapabilities } from "./capability-policy";
import type { WebMcpToolName } from "./capability.types";
import { reconcileToolNames } from "./registry-reconciler";
import type { ToolInvocationService } from "./tool-invocation.service";
import type { WebMcpAuditRecorder } from "./webmcp-audit";
import type { WebMcpToolDefinition } from "./webmcp-tool.types";

export class CapabilityRefreshService {
  private readonly registered = new Set<WebMcpToolName>();
  constructor(private readonly contexts: CapabilityContextService,
    private readonly tools: Record<WebMcpToolName, WebMcpToolDefinition>,
    private readonly invocations: ToolInvocationService, private readonly browser: BrowserWebMcpAdapter,
    private readonly audit: WebMcpAuditRecorder) {}

  async refreshCapabilities(subjectType: "INCIDENT" | "FINDING", subjectId: string) {
    const context = this.contexts.load(subjectType, subjectId);
    const evaluation = evaluateCapabilities(context);
    const desired = evaluation.allowed.map((decision) => decision.toolName);
    const delta = reconcileToolNames(this.registered, desired);
    for (const toolName of delta.removed) {
      if (await this.browser.unregister(toolName)) {
        this.registered.delete(toolName);
        const tool = this.tools[toolName];
        this.audit.record("WEBMCP_TOOL_UNREGISTERED", context, toolName, tool.classification,
          { changeType: "TOOL_REMOVED", reasonCode: "CAPABILITY_NO_LONGER_ALLOWED" });
      }
    }
    for (const toolName of delta.added) {
      const tool = this.tools[toolName];
      const registered = await this.browser.register({
        name: tool.name, description: tool.description,
        inputSchema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
        annotations: tool.classification === "READ" ? { readOnlyHint: true } : undefined,
        execute: async (input, options) => {
          if (options?.signal?.aborted) throw Object.assign(new Error("WebMCP tool invocation was cancelled."), { name: "AbortError" });
          return this.invocations.invoke(toolName, input);
        },
      });
      if (registered) {
        this.registered.add(toolName);
        const decision = evaluation.allowed.find((item) => item.toolName === toolName)!;
        this.audit.record("WEBMCP_TOOL_REGISTERED", context, toolName, tool.classification,
          { changeType: "TOOL_AVAILABLE", reasonCode: decision.reasonCode });
      }
    }
    return { context, evaluation, delta, webMcpAvailable: this.browser.isAvailable(),
      registered: [...this.registered].sort() };
  }
}

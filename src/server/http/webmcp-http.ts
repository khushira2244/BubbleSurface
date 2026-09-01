import { NextResponse } from "next/server";
import { z } from "zod";
import { capabilityContextService, webMcpInvocationService, webMcpTools } from "../container";
import { evaluateCapabilities } from "../webmcp/capability-policy";
import { CapabilitySubjectNotFoundError } from "../webmcp/capability-context.service";
import { webMcpToolNameSchema } from "../webmcp/capability.types";
import {
  CapabilityNotAllowedError,
  StaleCapabilityContextError,
  StaleProposalApprovalError,
} from "../webmcp/tool-invocation.service";
import { ToolTargetNotRelatedError } from "../webmcp/tool-definitions";
import { ExecutionError } from "../execution/execution.errors";
import { VerificationError } from "../verification/verification.errors";
import { demoBrowserPrincipalResolver } from "../webmcp/demo-principal-resolver";

export function readBrowserCapabilities(subjectId: string): NextResponse {
  try {
    const context = capabilityContextService.load("INCIDENT", subjectId);
    const evaluation = evaluateCapabilities(context);
    const tools = evaluation.allowed.map(({ toolName }) => {
      const tool = webMcpTools[toolName];
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
        annotations: tool.classification === "READ" ? { readOnlyHint: true } : undefined,
      };
    });
    return NextResponse.json({ context, tools });
  } catch (error) {
    return webMcpError(error);
  }
}

export async function invokeBrowserTool(toolName: string, request: Request): Promise<NextResponse> {
  try {
    const principal = await demoBrowserPrincipalResolver.resolve(request);
    const parsedToolName = webMcpToolNameSchema.parse(toolName);
    const input = await request.json();
    return NextResponse.json(await webMcpInvocationService.invoke(parsedToolName, input, principal.id));
  } catch (error) {
    return webMcpError(error);
  }
}

function webMcpError(error: unknown): NextResponse {
  if (error instanceof ExecutionError) return NextResponse.json({ error: { code:error.code,message:error.message } }, { status:error.httpStatus });
  if (error instanceof VerificationError) return NextResponse.json({ error: { code:error.code,message:error.message } }, { status:error.httpStatus });
  if (error instanceof CapabilitySubjectNotFoundError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 404 });
  }
  if (error instanceof StaleCapabilityContextError) {
    return NextResponse.json({ error: {
      code: error.code,
      message: error.message,
      expectedLifecycleVersion: error.expectedLifecycleVersion,
      actualLifecycleVersion: error.actualLifecycleVersion,
    } }, { status: 409 });
  }
  if (error instanceof StaleProposalApprovalError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 409 });
  }
  if (error instanceof CapabilityNotAllowedError) {
    return NextResponse.json({ error: {
      code: error.code, message: error.message, toolName: error.toolName, reasonCode: error.reasonCode,
    } }, { status: 409 });
  }
  if (error instanceof ToolTargetNotRelatedError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 });
  }
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return NextResponse.json({ error: {
      code: "VALIDATION_ERROR",
      message: "WebMCP tool input is invalid.",
      ...(error instanceof z.ZodError ? { issues: error.issues } : {}),
    } }, { status: 400 });
  }
  return NextResponse.json({ error: {
    code: "INTERNAL_ERROR", message: "The WebMCP request could not be completed.",
  } }, { status: 500 });
}

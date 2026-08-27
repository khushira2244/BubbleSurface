import { NextResponse } from "next/server";
import { z } from "zod";
import { lifecycleService } from "../container";
import type { CaseType, LifecycleCommand } from "../domain/lifecycle/lifecycle.types";
import { apiError } from "./api-errors";

export const commandSlugMap = {
  "start-triage": "START_TRIAGE",
  "start-investigation": "START_INVESTIGATION",
  "validate": "VALIDATE_CASE",
  "prepare-response": "PREPARE_RESPONSE",
  "request-approval": "REQUEST_APPROVAL",
  "start-containment": "START_CONTAINMENT",
  "mark-contained": "MARK_CONTAINED",
  "start-verification": "START_VERIFICATION",
  "mark-recovered": "MARK_RECOVERED",
  "close": "CLOSE_CASE",
} as const satisfies Record<string, LifecycleCommand>;

const commandBodySchema = z.object({
  expectedVersion: z.number().int().positive(),
  actorId: z.string().trim().min(1).max(100),
}).strict();

export function lifecycleCommandHandler(caseType: CaseType) {
  return async (request: Request, context: { params: Promise<{ id: string; command: string }> }) => {
    try {
      const { id, command: slug } = await context.params;
      const command = commandSlugMap[slug as keyof typeof commandSlugMap];
      if (!command) return NextResponse.json({ error: {
        code: "UNKNOWN_COMMAND", message: `Unknown lifecycle command: ${slug}.`,
      } }, { status: 404 });
      const body = commandBodySchema.parse(await request.json());
      return NextResponse.json({ data: lifecycleService.execute({
        caseId: id, caseType, command, ...body,
      }) });
    } catch (error) { return apiError(error); }
  };
}

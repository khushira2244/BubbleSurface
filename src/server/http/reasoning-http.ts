import { NextResponse } from "next/server";
import { z } from "zod";
import { securityReasoningService } from "../container";
import { InvalidEvidenceReferenceError } from "../domain/control-plane/evidence-reference.validator";
import { SecurityContextNotFoundError } from "../domain/security/security-context.service";
import { ReasoningError } from "../reasoning/reasoning.errors";

const requestSchema = z.object({ expectedVersion: z.number().int().positive().optional() }).strict();

export async function reasonIncidentHttp(id: string, request: Request) {
  try {
    const text = await request.text();
    const input = requestSchema.parse(text ? JSON.parse(text) : {});
    return NextResponse.json(await securityReasoningService.reasonIncident(id, input.expectedVersion));
  } catch (error) {
    if (error instanceof ReasoningError) return NextResponse.json({ error: {
      code: error.code, message: error.message,
      ...(error.code === "STALE_REASONING_LIFECYCLE" ? {
        expectedVersion: (error as ReasoningError & { expectedVersion: number }).expectedVersion,
        actualVersion: (error as ReasoningError & { actualVersion: number }).actualVersion,
      } : {}),
    } }, { status: error.httpStatus });
    if (error instanceof InvalidEvidenceReferenceError) return NextResponse.json({ error: {
      code: error.code, message: error.message, invalidEvidenceRefs: error.invalidEvidenceRefs,
    } }, { status: 422 });
    if (error instanceof SecurityContextNotFoundError) return NextResponse.json({ error: {
      code: error.code, message: error.message,
    } }, { status: 404 });
    if (error instanceof z.ZodError || error instanceof SyntaxError) return NextResponse.json({ error: {
      code: "VALIDATION_ERROR", message: "Reasoning request is invalid.",
    } }, { status: 400 });
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Reasoning could not be completed." } }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { lifecycleService } from "../container";
import type { CaseType } from "../domain/lifecycle/lifecycle.types";
import { apiError } from "./api-errors";

const createCaseSchema = z.object({ title: z.string().trim().min(3).max(200) }).strict();
export function createCaseHandler(caseType: CaseType) {
  return async (request: Request) => {
    try {
      const { title } = createCaseSchema.parse(await request.json());
      return NextResponse.json({ data: lifecycleService.createCase(caseType, title) }, { status: 201 });
    } catch (error) { return apiError(error); }
  };
}

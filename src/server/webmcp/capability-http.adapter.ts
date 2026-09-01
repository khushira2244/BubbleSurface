import { z } from "zod";
import { AuthoritativeVersionMismatchError, CapabilityEnforcementService, ReusableCapabilityDeniedError } from "./capability-enforcement.service";
import { UnknownCapabilityError } from "./capability-registry";
import type { AuthoritativeState, CapabilitySubject, PrincipalResolver } from "./integration-contracts";

export interface CapabilityHttpResult { status: number; body: Record<string, unknown> }
export interface CapabilityInvocationRequest {
  capabilityId: string; subject: CapabilitySubject; expectedVersion: number; arguments: unknown;
}

/** Framework-neutral HTTP-shaped adapter. Framework routes translate its status/body to their response type. */
export class CapabilityHttpAdapter<TRequestContext, TState extends AuthoritativeState> {
  constructor(private readonly enforcement: CapabilityEnforcementService<TState>,
    private readonly principals: PrincipalResolver<TRequestContext>) {}

  async discover(requestContext: TRequestContext, subject: CapabilitySubject): Promise<CapabilityHttpResult> {
    try {
      const principal = await this.principals.resolve(requestContext);
      const result = await this.enforcement.getCapabilities(subject, principal);
      const tools = result.decisions.filter(({ decision }) => decision.allowed).map(({ descriptor, decision }) => ({
        name: descriptor.name, description: descriptor.description, classification: descriptor.classification,
        inputSchema: z.toJSONSchema(descriptor.inputSchema) as Record<string, unknown>,
        annotations: descriptor.classification === "READ" ? { readOnlyHint: true } : undefined,
        reasonCode: decision.reasonCode,
      }));
      return { status: 200, body: { context: { subjectId: result.state.subject.id,
        lifecycleVersion: result.state.version, state: result.state.state }, tools } };
    } catch (error) { return this.error(error); }
  }

  async invoke(requestContext: TRequestContext, request: CapabilityInvocationRequest): Promise<CapabilityHttpResult> {
    try {
      const principal = await this.principals.resolve(requestContext);
      const data = await this.enforcement.invoke({ ...request, principal });
      return { status: 200, body: { data } };
    } catch (error) { return this.error(error); }
  }

  private error(error: unknown): CapabilityHttpResult {
    if (error instanceof UnknownCapabilityError) return { status: 404, body: { error: { code: error.code, message: error.message } } };
    if (error instanceof AuthoritativeVersionMismatchError) return { status: 409, body: { error: { code: error.code,
      message: error.message, expectedVersion: error.expectedVersion, actualVersion: error.actualVersion } } };
    if (error instanceof ReusableCapabilityDeniedError) return { status: 403, body: { error: { code: error.code,
      message: error.message, capabilityId: error.capabilityId, reasonCode: error.reasonCode } } };
    if (error instanceof z.ZodError) return { status: 400, body: { error: { code: "VALIDATION_ERROR",
      message: "Capability input is invalid.", issues: error.issues } } };
    return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "BubbleSurface request failed." } } };
  }
}

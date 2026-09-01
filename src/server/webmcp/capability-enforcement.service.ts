import type { CapabilityRegistry } from "./capability-registry";
import type { AuthoritativeState, AuthoritativeStateProvider, CapabilityPolicy, CapabilitySubject, ResolvedPrincipal } from "./integration-contracts";
import type { WebMcpToolDefinition } from "./webmcp-tool.types";

export class AuthoritativeVersionMismatchError extends Error {
  readonly code = "AUTHORITATIVE_VERSION_MISMATCH";
  constructor(readonly expectedVersion: number, readonly actualVersion: number) {
    super(`Expected authoritative version ${expectedVersion}, but current version is ${actualVersion}.`);
  }
}
export class ReusableCapabilityDeniedError extends Error {
  readonly code = "CAPABILITY_DENIED";
  constructor(readonly capabilityId: string, readonly reasonCode: string, message: string) { super(message); }
}

export interface SensitiveInvocationAuthorizer<TState extends AuthoritativeState> {
  authorize(input: { descriptor: WebMcpToolDefinition; state: TState; rawInput: unknown }): void | Promise<void>;
}

/** Vendor- and demo-neutral server boundary. Applications supply state, policy and sensitive-action authorization. */
export class CapabilityEnforcementService<TState extends AuthoritativeState> {
  constructor(private readonly registry: CapabilityRegistry, private readonly states: AuthoritativeStateProvider<TState>,
    private readonly policy: CapabilityPolicy<TState>, private readonly sensitive?: SensitiveInvocationAuthorizer<TState>) {}

  async getCapabilities(subject: CapabilitySubject, principal: ResolvedPrincipal) {
    const state = await this.states.load(subject, principal);
    return { state, decisions: this.registry.list().map((descriptor) => ({ descriptor,
      decision: this.policy.evaluate(state, descriptor) })) };
  }

  async invoke(input: { capabilityId: string; subject: CapabilitySubject; principal: ResolvedPrincipal;
    expectedVersion: number; arguments: unknown }) {
    const descriptor = this.registry.require(input.capabilityId);
    const parsed = descriptor.inputSchema.parse(input.arguments);
    const state = await this.states.load(input.subject, input.principal);
    if (state.version !== input.expectedVersion) throw new AuthoritativeVersionMismatchError(input.expectedVersion, state.version);
    const decision = this.policy.evaluate(state, descriptor);
    if (!decision.allowed) throw new ReusableCapabilityDeniedError(descriptor.name, decision.reasonCode, decision.reason);
    if (descriptor.classification === "EXECUTE" || descriptor.classification === "VERIFY") {
      if (!this.sensitive) throw new ReusableCapabilityDeniedError(descriptor.name, "SENSITIVE_AUTHORIZER_REQUIRED",
        "A sensitive invocation authorizer is required for this capability.");
      await this.sensitive.authorize({ descriptor, state, rawInput: parsed });
    }
    return descriptor.outputSchema.parse(await descriptor.execute(parsed, { subjectId: state.subject.id,
      expectedLifecycleVersion: state.version, actorId: state.actor.id }));
  }
}

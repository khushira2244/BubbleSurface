import type { WebMcpToolDefinition } from "./webmcp-tool.types";

export class DuplicateCapabilityError extends Error {
  readonly code = "DUPLICATE_CAPABILITY";
  constructor(readonly capabilityId: string) { super(`Capability ${capabilityId} is already registered.`); }
}
export class UnknownCapabilityError extends Error {
  readonly code = "UNKNOWN_CAPABILITY";
  constructor(readonly capabilityId: string) { super(`Unknown capability: ${capabilityId}.`); }
}

/** Application-facing catalog. BubbleSurface owns registration mechanics; applications own descriptors and handlers. */
export class CapabilityRegistry<TDefinition extends WebMcpToolDefinition = WebMcpToolDefinition> {
  private readonly definitions = new Map<string, TDefinition>();

  constructor(initial: Iterable<TDefinition> = []) { for (const descriptor of initial) this.register(descriptor); }

  register(descriptor: TDefinition): this {
    if (this.definitions.has(descriptor.name)) throw new DuplicateCapabilityError(descriptor.name);
    this.definitions.set(descriptor.name, descriptor);
    return this;
  }

  get(capabilityId: string): TDefinition | undefined { return this.definitions.get(capabilityId); }
  require(capabilityId: string): TDefinition {
    const descriptor = this.get(capabilityId);
    if (!descriptor) throw new UnknownCapabilityError(capabilityId);
    return descriptor;
  }
  list(): TDefinition[] { return [...this.definitions.values()]; }
  toRecord(): Record<string, TDefinition> { return Object.fromEntries(this.definitions); }
}

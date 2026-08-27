import type { WebMcpToolName } from "./capability.types";

export interface RegistryDelta { added: WebMcpToolName[]; retained: WebMcpToolName[]; removed: WebMcpToolName[] }
export function reconcileToolNames(current: Iterable<WebMcpToolName>, desired: Iterable<WebMcpToolName>): RegistryDelta {
  const currentSet = new Set(current), desiredSet = new Set(desired);
  const sort = (values: WebMcpToolName[]) => values.sort((a, b) => a.localeCompare(b));
  return {
    added: sort([...desiredSet].filter((name) => !currentSet.has(name))),
    retained: sort([...desiredSet].filter((name) => currentSet.has(name))),
    removed: sort([...currentSet].filter((name) => !desiredSet.has(name))),
  };
}

export interface RegistryDelta<TName extends string = string> { added: TName[]; retained: TName[]; removed: TName[] }
export function reconcileToolNames<TName extends string>(current: Iterable<TName>, desired: Iterable<TName>): RegistryDelta<TName> {
  const currentSet = new Set(current), desiredSet = new Set(desired);
  const sort = (values: TName[]) => values.sort((a, b) => a.localeCompare(b));
  return {
    added: sort([...desiredSet].filter((name) => !currentSet.has(name))),
    retained: sort([...desiredSet].filter((name) => currentSet.has(name))),
    removed: sort([...currentSet].filter((name) => !desiredSet.has(name))),
  };
}

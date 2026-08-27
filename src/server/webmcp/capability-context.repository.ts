import type { CapabilityContext } from "./capability.types";

export interface CapabilityContextRepository {
  derive(subjectType: "INCIDENT" | "FINDING", subjectId: string): CapabilityContext | null;
}

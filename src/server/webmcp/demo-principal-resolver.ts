import type { PrincipalResolver, ResolvedPrincipal } from "./integration-contracts";

/** Explicitly unauthenticated demo resolver. Production applications must resolve from their trusted server session. */
export class DemoPrincipalResolver<TRequestContext = unknown> implements PrincipalResolver<TRequestContext> {
  constructor(private readonly principal: ResolvedPrincipal) {}
  resolve(_requestContext: TRequestContext): ResolvedPrincipal { return this.principal; }
}

export const demoBrowserPrincipalResolver = new DemoPrincipalResolver<Request>({
  id: "browser-agent", type: "AGENT", permissions: ["INVESTIGATE", "PREPARE", "APPROVE", "EXECUTE", "VERIFY"],
  roles: ["DEMO_BROWSER_AGENT"],
});
export const demoReviewPrincipalResolver = new DemoPrincipalResolver<Request>({
  id: "analyst-kavya", type: "HUMAN", permissions: ["INVESTIGATE", "PREPARE", "APPROVE", "EXECUTE", "VERIFY"],
  roles: ["DEMO_ANALYST"],
});

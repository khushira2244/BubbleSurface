import { NextResponse } from "next/server";
import { z } from "zod";
import { securityContextService } from "../container";
import { SecurityContextNotFoundError, SecurityContextService } from "../domain/security/security-context.service";

const entityIdSchema = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
type Reader = (service: SecurityContextService, id: string) => unknown;

export function securityReadHandler(reader: Reader, service = securityContextService) {
  return async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = entityIdSchema.parse((await context.params).id);
      return NextResponse.json({ data: reader(service, id) });
    } catch (error) {
      if (error instanceof SecurityContextNotFoundError) {
        return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 404 });
      }
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: { code: "INVALID_ENTITY_ID", message: "The entity ID is invalid.", issues: error.issues } }, { status: 400 });
      }
      return NextResponse.json({ error: { code: "SECURITY_CONTEXT_READ_FAILED", message: "Security context could not be read." } }, { status: 500 });
    }
  };
}

export const readIncident = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getIncident(id), service);
export const readIncidentContext = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getIncidentContext(id), service);
export const readFinding = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getFinding(id), service);
export const readFindingContext = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getFindingContext(id), service);
export const readIdentityContext = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getIdentityContext(id), service);
export const readIdentitySessions = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getActiveSessions(id), service);
export const readIdentityPrivileges = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getPrivileges(id), service);
export const readIncidentEvents = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getIncidentEvents(id), service);
export const readIncidentEvidence = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getIncidentEvidence(id), service);

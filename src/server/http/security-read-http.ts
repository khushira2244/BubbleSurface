import { NextResponse } from "next/server";
import { z } from "zod";
import { identityProvider, securityContextService, securityEventSource } from "../container";
import { SecurityContextNotFoundError, SecurityContextService } from "../domain/security/security-context.service";
import type { SecurityEventSource } from "../integrations/security-ports";
import type { IdentityProvider } from "../integrations/security-ports";

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
export const readIdentityContext = (service=securityContextService,provider:IdentityProvider=identityProvider)=>async(_request:Request,context:{params:Promise<{id:string}>})=>{try{const id=entityIdSchema.parse((await context.params).id);service.getIdentityContext(id);const state=await provider.getIdentityState(id);if(!state)throw new SecurityContextNotFoundError("Identity",id);return NextResponse.json({data:state});}catch(error){if(error instanceof SecurityContextNotFoundError)return NextResponse.json({error:{code:error.code,message:error.message}},{status:404});return NextResponse.json({error:{code:"IDENTITY_PROVIDER_READ_FAILED",message:"Identity context could not be read."}},{status:502});}};
export const readIdentitySessions = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getActiveSessions(id), service);
export const readIdentityPrivileges = (service=securityContextService,provider:IdentityProvider=identityProvider)=>async(_request:Request,context:{params:Promise<{id:string}>})=>{try{const id=entityIdSchema.parse((await context.params).id);service.getIdentityContext(id);const privileges=await provider.getGroupsOrPrivileges(id);return NextResponse.json({data:privileges.map(privilege=>({...privilege,provider:provider.provider??"demo"}))});}catch(error){if(error instanceof SecurityContextNotFoundError)return NextResponse.json({error:{code:error.code,message:error.message}},{status:404});return NextResponse.json({error:{code:"IDENTITY_PROVIDER_READ_FAILED",message:"Identity privileges could not be read."}},{status:502});}};
export const readIncidentEvents = (service = securityContextService, events: SecurityEventSource = securityEventSource) =>
  async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const id = entityIdSchema.parse((await context.params).id);
      service.getIncident(id);
      return NextResponse.json({ data: await events.getEventsForIncident(id) });
    } catch (error) {
      if (error instanceof SecurityContextNotFoundError) return NextResponse.json({ error: {
        code: error.code, message: error.message,
      } }, { status: 404 });
      if (error instanceof z.ZodError) return NextResponse.json({ error: {
        code: "INVALID_ENTITY_ID", message: "The entity ID is invalid.", issues: error.issues,
      } }, { status: 400 });
      return NextResponse.json({ error: {
        code: "SECURITY_EVENT_READ_FAILED", message: "Security events could not be read.",
      } }, { status: 502 });
    }
  };
export const readIncidentEvidence = (service?: SecurityContextService) => securityReadHandler((s, id) => s.getIncidentEvidence(id), service);

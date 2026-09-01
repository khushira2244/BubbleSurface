import Database from "better-sqlite3";
import { describe,expect,it } from "vitest";
import { initializeSecuritySchema } from "../db/security-schema";
import { ControlPlaneService } from "../domain/control-plane/control-plane.service";
import { EvidenceReferenceValidator } from "../domain/control-plane/evidence-reference.validator";
import { SqliteControlPlaneRepository } from "../repositories/sqlite-control-plane.repository";
import { SqliteSecurityContextRepository } from "../repositories/sqlite-security-context.repository";
import { seedSecurityData } from "../seed/seed-security-data";
import { readIncidentToolActivity } from "./tool-activity-http";

describe("tool activity read path",()=>{it("returns sanitized authoritative WebMCP audit events only",async()=>{const db=new Database(":memory:");initializeSecuritySchema(db);seedSecurityData(db);
  const service=new ControlPlaneService(new SqliteControlPlaneRepository(db),new EvidenceReferenceValidator(new SqliteSecurityContextRepository(db)));
  service.appendAuditEvent({id:"AUD-1",subjectType:"INCIDENT",subjectId:"INC-1001",actorType:"WEBMCP",actorId:null,eventType:"WEBMCP_TOOL_CALLED",actionId:null,proposalVersion:null,executionId:null,lifecycleVersion:3,source:"browser-webmcp",metadata:{toolName:"inspect_incident",actorId:"browser-agent"},occurredAt:"2026-08-27T08:00:00.000Z"});
  const response=readIncidentToolActivity("INC-1001",service),body=await response.json();expect(body.data).toEqual([expect.objectContaining({toolName:"inspect_incident",status:"STARTED",actorId:"browser-agent"})]);db.close();});});

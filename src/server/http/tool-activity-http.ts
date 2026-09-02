import { NextResponse } from "next/server";
import { z } from "zod";
import { controlPlaneService } from "../container";
import type { ControlPlaneService } from "../domain/control-plane/control-plane.service";

const idSchema=z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
const visible=new Set(["WEBMCP_TOOL_CALLED","WEBMCP_TOOL_SUCCEEDED","WEBMCP_TOOL_FAILED","WEBMCP_TOOL_BLOCKED",
  "INVESTIGATION_VALIDATED","ACTION_PROPOSAL_CREATED","HUMAN_REVIEW_REQUIRED","ACTION_APPROVED","ACTION_REJECTED","ACTION_MODIFIED"]);

export function readIncidentToolActivity(subjectId:string,service:ControlPlaneService=controlPlaneService){
  try{
    const id=idSchema.parse(subjectId);
    const activity=service.listAuditEvents("INCIDENT",id).filter(event=>visible.has(event.eventType)).map(event=>({
      id:event.id,eventType:event.eventType,toolName:typeof event.metadata.toolName==="string"?event.metadata.toolName:"unknown_tool",
      status:event.eventType==="WEBMCP_TOOL_FAILED"||event.eventType==="WEBMCP_TOOL_BLOCKED"?"FAILED":event.eventType==="WEBMCP_TOOL_CALLED"?"STARTED":"SUCCEEDED",
      label:event.eventType.startsWith("WEBMCP_")?undefined:event.eventType.replaceAll("_"," ").toLowerCase(),
      actorType:event.actorType,actorId:typeof event.metadata.actorId==="string"?event.metadata.actorId:event.actorId,
      occurredAt:event.occurredAt,lifecycleVersion:event.lifecycleVersion,
    }));
    return NextResponse.json({data:activity});
  }catch(error){
    if(error instanceof z.ZodError)return NextResponse.json({error:{code:"INVALID_INCIDENT_ID",message:"The incident ID is invalid."}},{status:400});
    return NextResponse.json({error:{code:"TOOL_ACTIVITY_READ_FAILED",message:"Tool activity could not be read."}},{status:500});
  }
}

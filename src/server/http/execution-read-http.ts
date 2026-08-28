import { NextResponse } from "next/server";
import { controlPlaneService } from "../container";
export const listExecutions=(actionId:string)=>NextResponse.json({actionId,executions:controlPlaneService.listExecutionRecords(actionId)});
export const readExecution=(id:string)=>{const execution=controlPlaneService.getExecutionRecord(id);return execution?NextResponse.json(execution):NextResponse.json({error:{code:"EXECUTION_NOT_FOUND",message:"Execution was not found."}},{status:404});};

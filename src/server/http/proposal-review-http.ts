import { NextResponse } from "next/server";
import { z } from "zod";
import { proposalReviewService } from "../container";
import { ProposalReviewError } from "../review/proposal-review.errors";

const id=z.string().trim().min(1).max(100);
const review=z.object({proposalVersion:z.number().int().positive(),expectedLifecycleVersion:z.number().int().positive(),actorId:id,comment:z.string().max(1000).optional()}).strict();
const modify=review.extend({parameters:z.record(z.string(),z.unknown()).optional(),rationale:z.string().trim().min(1).max(1500).optional()}).strict();
const error=(cause:unknown)=>cause instanceof ProposalReviewError?NextResponse.json({error:{code:cause.code,message:cause.message}},{status:cause.httpStatus}):cause instanceof z.ZodError?NextResponse.json({error:{code:"VALIDATION_ERROR",message:"Proposal review request is invalid.",issues:cause.issues}},{status:400}):NextResponse.json({error:{code:"INTERNAL_ERROR",message:"Proposal review could not be completed."}},{status:500});
export const listProposals=(subjectId:string)=>{try{return NextResponse.json(proposalReviewService.list(subjectId));}catch(e){return error(e);}};
export const readAction=(actionId:string)=>{try{return NextResponse.json(proposalReviewService.read(actionId));}catch(e){return error(e);}};
export const reviewAction=async(actionId:string,kind:"approve"|"reject"|"modify",request:Request)=>{try{const raw=await request.json();const input=(kind==="modify"?modify:review).parse(raw);return NextResponse.json(kind==="approve"?proposalReviewService.approve({actionId,...input}):kind==="reject"?proposalReviewService.reject({actionId,...input}):proposalReviewService.modify({actionId,...input}));}catch(e){return error(e);}};

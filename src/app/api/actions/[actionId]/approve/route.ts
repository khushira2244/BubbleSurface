import { reviewAction } from "@/server/http/proposal-review-http";
export async function POST(request:Request,{params}:{params:Promise<{actionId:string}>}){return reviewAction((await params).actionId,"approve",request);}

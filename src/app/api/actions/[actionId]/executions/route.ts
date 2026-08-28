import { listExecutions } from "@/server/http/execution-read-http";
export async function GET(_request:Request,{params}:{params:Promise<{actionId:string}>}){return listExecutions((await params).actionId);}

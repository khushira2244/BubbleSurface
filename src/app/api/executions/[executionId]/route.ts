import { readExecution } from "@/server/http/execution-read-http";
export async function GET(_request:Request,{params}:{params:Promise<{executionId:string}>}){return readExecution((await params).executionId);}

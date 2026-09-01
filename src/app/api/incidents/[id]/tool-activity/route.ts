import { readIncidentToolActivity } from "@/server/http/tool-activity-http";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return readIncidentToolActivity((await params).id);}

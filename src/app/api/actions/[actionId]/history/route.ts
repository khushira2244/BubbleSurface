import { readAction } from "@/server/http/proposal-review-http";
export async function GET(_request:Request,{params}:{params:Promise<{actionId:string}>}){return readAction((await params).actionId);}

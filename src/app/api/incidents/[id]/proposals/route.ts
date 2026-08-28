import { listProposals } from "@/server/http/proposal-review-http";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){return listProposals((await params).id);}

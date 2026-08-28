import { reasonIncidentHttp } from "@/server/http/reasoning-http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return reasonIncidentHttp(id, request);
}

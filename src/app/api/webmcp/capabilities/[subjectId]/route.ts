import { readBrowserCapabilities } from "@/server/http/webmcp-http";

export async function GET(_request: Request, context: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await context.params;
  return readBrowserCapabilities(subjectId);
}

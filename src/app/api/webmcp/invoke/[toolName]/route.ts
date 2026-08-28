import { invokeBrowserTool } from "@/server/http/webmcp-http";

export async function POST(request: Request, context: { params: Promise<{ toolName: string }> }) {
  const { toolName } = await context.params;
  return invokeBrowserTool(toolName, request);
}

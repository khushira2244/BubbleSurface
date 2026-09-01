import { LiveWorkspace } from "@/components/demo/live-workspace";
import { buildLiveWorkspaceModel } from "@/components/demo/live-workspace.model";
import { capabilityContextService, securityContextService } from "@/server/container";
import { evaluateCapabilities } from "@/server/webmcp/capability-policy";

export const dynamic = "force-dynamic";

export default function LiveDemoPage() {
  const incident = securityContextService.getIncidentContext("INC-1001");
  const capabilities = evaluateCapabilities(capabilityContextService.load("INCIDENT", "INC-1001")).allowed;
  return <LiveWorkspace model={buildLiveWorkspaceModel(incident, capabilities.map(({ toolName, classification }) => ({ toolName, classification })))}/>;
}

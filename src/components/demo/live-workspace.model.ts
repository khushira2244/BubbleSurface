import type { HumanSurfaceModel } from "../bubblesurface";
import type { IncidentContext } from "../../server/domain/security/security.schemas";

export interface LiveWorkspaceModel {
  incident: IncidentContext["incident"];
  lifecycle: IncidentContext["lifecycle"];
  identity: NonNullable<IncidentContext["identity"]>;
  sessions: IncidentContext["sessions"];
  privileges: IncidentContext["privileges"];
  events: IncidentContext["events"];
  capabilities: Array<{ toolName: string; classification: string }>;
  humanSurface: HumanSurfaceModel;
}

export function buildLiveWorkspaceModel(context: IncidentContext,
  capabilities: LiveWorkspaceModel["capabilities"]): LiveWorkspaceModel {
  if (!context.identity) throw new Error(`Incident ${context.incident.id} has no affected identity.`);
  const humanSurface: HumanSurfaceModel = {
    subject: { id: context.incident.id, type: "INCIDENT", label: context.identity.displayName, title: "Human intervention" },
    status: "IDLE",
    execution: { state: "NONE" },
    verification: { state: "NONE", checks: [] },
    activity: [],
    updatedAt: context.lifecycle.updatedAt,
  };
  return { incident: context.incident, lifecycle: context.lifecycle, identity: context.identity,
    sessions: context.sessions, privileges: context.privileges, events: context.events, capabilities, humanSurface };
}

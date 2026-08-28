export type AnalystPermission = "INVESTIGATE" | "PREPARE" | "APPROVE" | "EXECUTE" | "VERIFY";
export class DemoAnalystResolver {
  resolve(actorId: string): { actorId: string; permissions: AnalystPermission[] } {
    return { actorId, permissions: actorId === "analyst-kavya" || actorId === "browser-agent"
      ? ["INVESTIGATE", "PREPARE", "APPROVE", "EXECUTE", "VERIFY"] : [] };
  }
}

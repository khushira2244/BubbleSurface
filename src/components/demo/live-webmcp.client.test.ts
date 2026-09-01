import { describe,expect,it,vi } from "vitest";
import type { BrowserWebMcpAdapter } from "../../server/webmcp/browser-webmcp.adapter";
import type { CapabilitySnapshotTransport } from "../../server/webmcp/integration-contracts";
import type { BrowserToolRegistration } from "../../server/webmcp/webmcp-tool.types";
import { initializeLiveWebMcp,LIVE_DEMO_SUBJECT } from "./live-webmcp.client";

class MemoryAdapter implements BrowserWebMcpAdapter{tools=new Map<string,BrowserToolRegistration>();isAvailable(){return true}async register(tool:BrowserToolRegistration){this.tools.set(tool.name,tool);return true}async unregister(name:string){return this.tools.delete(name)}}
const names=["inspect_incident","get_active_sessions","get_device_context","check_privilege_changes","review_evidence_timeline"];

describe("live WebMCP initialization",()=>{
  it("initializes INC-1001 from authoritative discovery and routes invocation through transport",async()=>{const adapter=new MemoryAdapter();
    const invoke=vi.fn(async()=>({kind:"incident_context"}));const transport:CapabilitySnapshotTransport={getCapabilities:vi.fn(async subject=>{
      expect(subject).toEqual(LIVE_DEMO_SUBJECT);return{context:{subjectId:"INC-1001",lifecycleVersion:3},tools:names.map(name=>({name,description:name,inputSchema:{type:"object"}}))}}),invoke};
    const changes=vi.fn(),integration=await initializeLiveWebMcp({transport,adapter,onChange:changes,onError:vi.fn(),refreshIntervalMs:0});
    expect([...adapter.tools.keys()].sort()).toEqual([...names].sort());expect(adapter.tools.has("remove_approved_privilege")).toBe(false);expect(adapter.tools.has("verify_identity_state")).toBe(false);
    await adapter.tools.get("inspect_incident")!.execute({});expect(invoke).toHaveBeenCalledWith("inspect_incident",{subjectId:"INC-1001",expectedLifecycleVersion:3},undefined);
    await integration.dispose();
  });
});

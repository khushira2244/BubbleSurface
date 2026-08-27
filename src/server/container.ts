import { db } from "./db/sqlite";
import { LifecycleService } from "./domain/lifecycle/lifecycle.service";
import { SqliteCaseRepository } from "./repositories/sqlite-case.repository";
import { SecurityContextService } from "./domain/security/security-context.service";
import { SqliteSecurityContextRepository } from "./repositories/sqlite-security-context.repository";
import { seedSecurityData } from "./seed/seed-security-data";
import { EvidenceReferenceValidator } from "./domain/control-plane/evidence-reference.validator";
import { ControlPlaneService } from "./domain/control-plane/control-plane.service";
import { SqliteControlPlaneRepository } from "./repositories/sqlite-control-plane.repository";
import { SqliteIdentityAdapter } from "./integrations/sqlite-identity.adapter";
import { SqliteSecurityEventAdapter } from "./integrations/sqlite-security-event.adapter";
import { CapabilityContextService } from "./webmcp/capability-context.service";
import { SqliteCapabilityContextRepository } from "./webmcp/sqlite-capability-context.repository";
import { createWebMcpToolDefinitions } from "./webmcp/tool-definitions";
import { ControlPlaneWebMcpAuditRecorder } from "./webmcp/webmcp-audit";
import { ToolInvocationService } from "./webmcp/tool-invocation.service";
import { CapabilityRefreshService } from "./webmcp/capability-refresh.service";
import type { BrowserWebMcpAdapter } from "./webmcp/browser-webmcp.adapter";

seedSecurityData(db);
const securityRepository = new SqliteSecurityContextRepository(db);
export const lifecycleService = new LifecycleService(new SqliteCaseRepository(db));
export const securityContextService = new SecurityContextService(securityRepository);
const controlPlaneRepository = new SqliteControlPlaneRepository(db);
const evidenceReferenceValidator = new EvidenceReferenceValidator(securityRepository);
export const controlPlaneService = new ControlPlaneService(
  controlPlaneRepository,
  evidenceReferenceValidator,
);
export const identityProvider = new SqliteIdentityAdapter(securityRepository);
export const securityEventSource = new SqliteSecurityEventAdapter(db);
export const capabilityContextService = new CapabilityContextService(new SqliteCapabilityContextRepository(db));
export const webMcpTools = createWebMcpToolDefinitions({ securityContext: securityContextService, identityProvider,
  eventSource: securityEventSource, evidenceValidator: evidenceReferenceValidator });
export const webMcpAudit = new ControlPlaneWebMcpAuditRecorder(controlPlaneService);
export const webMcpInvocationService = new ToolInvocationService(capabilityContextService, webMcpTools, webMcpAudit);
export const createCapabilityRefreshService = (browser: BrowserWebMcpAdapter) =>
  new CapabilityRefreshService(capabilityContextService, webMcpTools, webMcpInvocationService, browser, webMcpAudit);

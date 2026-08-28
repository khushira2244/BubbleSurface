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
import { createSecurityEventSource } from "./integrations/security-event-source.factory";
import { getIntegrationConfig } from "./config/integrations";
import { CapabilityContextService } from "./webmcp/capability-context.service";
import { SqliteCapabilityContextRepository } from "./webmcp/sqlite-capability-context.repository";
import { createWebMcpToolDefinitions } from "./webmcp/tool-definitions";
import { ControlPlaneWebMcpAuditRecorder } from "./webmcp/webmcp-audit";
import { ToolInvocationService } from "./webmcp/tool-invocation.service";
import { CapabilityRefreshService } from "./webmcp/capability-refresh.service";
import type { BrowserWebMcpAdapter } from "./webmcp/browser-webmcp.adapter";
import { OpenAiResponsesClient, type ReasoningModelClient } from "./reasoning/openai-responses.client";
import { SecurityReasoningService } from "./reasoning/security-reasoning.service";
import { ReasoningProviderError } from "./reasoning/reasoning.errors";
import { SqliteProposalReviewRepository } from "./review/sqlite-proposal-review.repository";
import { ProposalReviewService } from "./review/proposal-review.service";
import { DemoIdentityActionExecutor } from "./execution/demo-identity-action.executor";
import { ActionExecutionService } from "./execution/action-execution.service";
import { ActionVerificationService } from "./verification/action-verification.service";
import { DemoIdentityVerificationSource } from "./verification/demo-identity-verification.source";

seedSecurityData(db);
const securityRepository = new SqliteSecurityContextRepository(db);
export const lifecycleService = new LifecycleService(new SqliteCaseRepository(db));
export const securityContextService = new SecurityContextService(securityRepository);
const controlPlaneRepository = new SqliteControlPlaneRepository(db);
export const evidenceReferenceValidator = new EvidenceReferenceValidator(securityRepository);
export const controlPlaneService = new ControlPlaneService(
  controlPlaneRepository,
  evidenceReferenceValidator,
);
export const identityProvider = new SqliteIdentityAdapter(securityRepository);
export const securityEventSource = createSecurityEventSource(db, getIntegrationConfig());
export const capabilityContextService = new CapabilityContextService(new SqliteCapabilityContextRepository(db));
const proposalReviewRepository = new SqliteProposalReviewRepository(db);
export const actionExecutionService = new ActionExecutionService(proposalReviewRepository,controlPlaneService,
  securityContextService,lifecycleService,new DemoIdentityActionExecutor(db));
export const actionVerificationService = new ActionVerificationService(proposalReviewRepository,controlPlaneService,
  securityContextService,lifecycleService,new DemoIdentityVerificationSource(db));
export const webMcpTools = createWebMcpToolDefinitions({ securityContext: securityContextService, identityProvider,
  eventSource: securityEventSource, evidenceValidator: evidenceReferenceValidator,
  executeApprovedAction:(input,actorId,expectedActionType)=>actionExecutionService.execute({...input,actorId,expectedActionType}),
  verifyApprovedAction:(input,actorId,kind)=>actionVerificationService.verify({...input,actorId,kind}) });
  
export const webMcpAudit = new ControlPlaneWebMcpAuditRecorder(controlPlaneService);
export const webMcpInvocationService = new ToolInvocationService(capabilityContextService, webMcpTools, webMcpAudit);
export const createCapabilityRefreshService = (browser: BrowserWebMcpAdapter) =>
  new CapabilityRefreshService(capabilityContextService, webMcpTools, webMcpInvocationService, browser, webMcpAudit);

const integrationConfig = getIntegrationConfig();
const unavailableReasoningClient: ReasoningModelClient = { createStructuredResponse: async () => {
  throw new ReasoningProviderError("REASONING_NOT_CONFIGURED", "OPENAI_API_KEY is not configured.");
} };
const reasoningModelClient = integrationConfig.OPENAI_API_KEY
  ? new OpenAiResponsesClient(integrationConfig.OPENAI_API_KEY, integrationConfig.OPENAI_MODEL)
  : unavailableReasoningClient;
export const securityReasoningService = new SecurityReasoningService(securityContextService, securityEventSource,
  evidenceReferenceValidator, controlPlaneService, reasoningModelClient);
export const proposalReviewService = new ProposalReviewService(proposalReviewRepository,
  controlPlaneService, securityContextService, evidenceReferenceValidator, lifecycleService);

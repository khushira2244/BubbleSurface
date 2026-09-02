# BubbleSurface developer usage

Examples below use current repository APIs and `@/` path aliases from `tsconfig.json`. BubbleSurface is not yet an external npm package.

## Use the reference workflow

The host and agent share one authoritative incident workflow:

```text
INVESTIGATING -> VALIDATED -> AWAITING_APPROVAL -> CONTAINING
-> CONTAINED -> VERIFYING -> RECOVERED
```

The human stays on `/demo/live`. That page renders persistent state and outcomes; `BubbleSurfacePanel` is the only decision surface; optional toasts provide transient awareness. The external agent discovers and invokes WebMCP capabilities from the page. It is not embedded in the panel.

Capability progression:

| Stage | Available operations |
| --- | --- |
| Investigate | `inspect_incident`, `get_active_sessions`, `get_device_context`, `check_privilege_changes`, `review_evidence_timeline` |
| Prepare | the five reads plus `prepare_containment` |
| Execute | the action-matching `revoke_approved_sessions` or `remove_approved_privilege` after exact approval |
| Verify | `verify_identity_state` and `verify_containment` after successful execution |
| Recovered | no sensitive execution or verification capability remains |

The ten descriptors exist in the application registry, but policy never exposes all ten simultaneously. Always use the lifecycle version returned by the latest capability snapshot. Use a new idempotency key for each distinct execute or verify operation.

## Initialize `BubbleSurfaceWeb`

```ts
import {
  BubbleSurfaceWeb,
  HttpCapabilitySnapshotTransport,
} from "@/server/webmcp/bubble-surface-web";

const web = await BubbleSurfaceWeb.init({
  subject: {
    type: "INCIDENT",
    id: currentIncidentId,
    category: "IDENTITY_SESSION_COMPROMISE",
  },
  transport: new HttpCapabilitySnapshotTransport(),
  refreshIntervalMs: 2_000,
  onChange: ({ available, registered, authoritativeVersion }) => {
    console.log({ available, registered, authoritativeVersion });
  },
  onError: (error) => console.error(error.code, error.message),
});
```

`BubbleSurfaceWeb.init()` performs the first refresh. If `document.modelContext.registerTool` is absent, it returns an initialized but unavailable controller and reports `WEBMCP_UNAVAILABLE` through the callbacks.

## Change the current subject

```ts
await web.setSubject({
  type: "INCIDENT",
  id: nextIncidentId,
});
```

`setSubject` aborts/supersedes an active snapshot fetch, clears the prior invocation context, and reconciles the new desired tools.

## Refresh explicitly

```ts
const state = await web.refresh();
console.log(state.delta.added, state.delta.retained, state.delta.removed);
```

Explicit refresh is useful after an application mutation not already routed through `RefreshingApprovalClient`. Browser tool invocation also triggers a background refresh in `finally`.

## Dispose the page integration

```ts
await web.dispose();
```

Disposal stops interval refresh, aborts an active request, and unregisters every tracked browser tool. Later `refresh()` or `setSubject()` calls reject because the controller is disposed.

## Register a capability descriptor

```ts
import { z } from "zod";
import { CapabilityRegistry } from "@/server/webmcp/capability-registry";
import type { WebMcpToolDefinition } from "@/server/webmcp/webmcp-tool.types";

const inspectAlert: WebMcpToolDefinition = {
  name: "inspect_alert",
  description: "Read the current alert and its related evidence.",
  classification: "READ",
  applicability: { subjectTypes: ["ALERT"] },
  policyRequirements: {
    permissions: ["INVESTIGATE"],
    authoritativeVersion: true,
  },
  inputSchema: z.object({
    subjectId: z.string(),
    expectedLifecycleVersion: z.number().int().positive(),
  }),
  outputSchema: z.object({ summary: z.string() }),
  execute: async (_input, context) => ({
    summary: await alertService.summarize(context.subjectId),
  }),
};

const registry = new CapabilityRegistry().register(inspectAlert);
```

The registry accepts arbitrary stable names. The demo's closed ten-name enum belongs to its compatibility routes, not to `CapabilityRegistry`.

## Discover through `CapabilityHttpAdapter`

```ts
import { CapabilityHttpAdapter } from "@/server/webmcp/capability-http.adapter";
import { CapabilityEnforcementService } from "@/server/webmcp/capability-enforcement.service";

const enforcement = new CapabilityEnforcementService(
  registry,
  authoritativeStateProvider,
  capabilityPolicy,
  sensitiveInvocationAuthorizer,
);
const http = new CapabilityHttpAdapter(enforcement, principalResolver);

const result = await http.discover(request, {
  type: "ALERT",
  id: alertId,
});

return Response.json(result.body, { status: result.status });
```

Successful discovery returns:

```ts
{
  context: { subjectId, lifecycleVersion, state },
  tools: [{ name, description, classification, inputSchema, annotations, reasonCode }]
}
```

Only allowed policy decisions appear in `tools`.

## Invoke through `CapabilityHttpAdapter`

```ts
const result = await http.invoke(request, {
  capabilityId: "inspect_alert",
  subject: { type: "ALERT", id: alertId },
  expectedVersion: body.expectedLifecycleVersion,
  arguments: body,
});

return Response.json(result.body, { status: result.status });
```

The adapter resolves the principal server-side. Enforcement parses input, reloads state, checks the authoritative version and current policy, authorizes sensitive classifications when applicable, calls the handler, and parses output.

## Implement `PrincipalResolver`

```ts
import type {
  PrincipalResolver,
  ResolvedPrincipal,
} from "@/server/webmcp/integration-contracts";

const principalResolver: PrincipalResolver<Request> = {
  async resolve(request): Promise<ResolvedPrincipal> {
    const session = await applicationSessions.require(request);
    return {
      id: session.subject,
      type: session.kind === "agent" ? "AGENT" : "HUMAN",
      permissions: session.permissions,
      roles: session.roles,
      context: { tenantId: session.tenantId },
    };
  },
};
```

`applicationSessions` is intentionally application-owned pseudocode. The `PrincipalResolver` interface and returned fields are current BubbleSurface APIs.

## Approval client with immediate capability refresh

```ts
import { RefreshingApprovalClient } from "@/server/webmcp/approval-refresh.client";
import { HttpHumanSurfaceClient } from "@/components/bubblesurface";

const rawApprovals = new HttpHumanSurfaceClient();
const approvals = new RefreshingApprovalClient(rawApprovals, web);

await approvals.approve({
  actionId,
  proposalVersion,
  expectedLifecycleVersion,
  comment: "Reviewed against the current evidence.",
});
```

The decorator waits for the mutation and then calls `web.refresh()`. It does not grant authority locally.

## Embed `BubbleSurfacePanel`

```tsx
import {
  BubbleSurfacePanel,
  HttpHumanSurfaceClient,
} from "@/components/bubblesurface";
import { RefreshingApprovalClient } from "@/server/webmcp/approval-refresh.client";

const client = new HttpHumanSurfaceClient();
const approvalClient = new RefreshingApprovalClient(client, web);
const reload = () => client.loadModel(subject, actionId);

<BubbleSurfacePanel
  mode="embedded"
  model={model}
  approvalClient={approvalClient}
  reload={reload}
  onModelChange={setModel}
/>
```

`model`, `subject`, `actionId`, `web`, and `setModel` come from the host application's page state. `BubbleSurfacePanel` also supports `mode="standalone"`. Without both `approvalClient` and `reload`, proposal controls render read-only.

## Current demo HTTP transport

`HttpCapabilitySnapshotTransport` currently calls:

- `GET /api/webmcp/capabilities/:subjectId`
- `POST /api/webmcp/invoke/:capabilityId`

`HttpHumanSurfaceClient` currently calls proposal/action, execution, verification, approve, reject, and modify routes under `/api/incidents/:id` and `/api/actions/:id`.

These are current demo route conventions. A reusable deployment may implement `CapabilitySnapshotTransport` and `ApprovalClient` against different URLs without changing `BubbleSurfaceWeb` or `BubbleSurfacePanel`.

# Installing and integrating BubbleSurface

BubbleSurface is not yet published as an npm package. This guide describes integration from the current repository source. Any package-style import shown outside this repository would be conceptual future packaging, not an available install command.

## Run the reference application

Prerequisites: Node.js 22, npm, and a browser. WebMCP discovery additionally requires a compatible browser/host or inspector. Docker is optional.

```sh
git clone https://github.com/khushira2244/BubbleSurface.git
cd BubbleSurface/hi
npm install
cp .env.example .env.local
npm run dev
```

The server creates `DATABASE_PATH`, initializes its SQLite schema, and idempotently seeds the reference fixture. Never commit `.env.local` or provider credentials.

## Architecture at a glance

```text
Client page -> BubbleSurfaceWeb -> document.modelContext / WebMCP

Client server -> CapabilityHttpAdapter -> PrincipalResolver
              -> authoritative state + policy -> capability handlers

Human UI -> ApprovalClient -> server mutation
         -> RefreshingApprovalClient -> BubbleSurfaceWeb.refresh()
```

The integrating application owns authentication, users, security data, domain state, proposals, actions, provider credentials, and the functions being exposed. BubbleSurface owns the capability-registration and governance boundaries.

## 1. Prerequisites

- A TypeScript web application with a client-side page lifecycle.
- A server endpoint capable of returning JSON capability snapshots and accepting invocation requests.
- A compatible browser environment exposing `document.modelContext.registerTool`; BubbleSurface feature-detects it and degrades safely when absent.
- An authoritative subject state with a monotonically changing version.
- Server-authenticated principals and permissions.
- Zod schemas for capability input and output.
- For consequential actions, persisted exact approval plus execution/replay and verification state.

The current reference application uses Next.js 15, React 19, TypeScript, Zod, SQLite, and optional Elastic/Auth0 integrations. The reusable contracts are not intended to require those demo providers.

## 2. Include the current source modules

Until packaging is complete, integrate by working in this repository or copying/extracting the relevant modules under the terms chosen by the project owner. The main current entry points are:

- `src/server/webmcp/bubble-surface-web.ts`
- `src/server/webmcp/capability-registry.ts`
- `src/server/webmcp/capability-enforcement.service.ts`
- `src/server/webmcp/capability-http.adapter.ts`
- `src/server/webmcp/integration-contracts.ts`
- `src/server/webmcp/approval-refresh.client.ts`
- `src/components/bubblesurface/index.ts`

There is currently no valid `npm install @bubblesurface/...` command.

## 3. Browser integration

Initialize one `BubbleSurfaceWeb` instance for the live page or route:

```ts
const web = await BubbleSurfaceWeb.init({
  subject: { type: "INCIDENT", id: currentIncidentId },
  transport: new HttpCapabilitySnapshotTransport(),
  refreshIntervalMs: 2_000,
  onChange: (state) => updateIntegrationStatus(state),
  onError: (error) => reportIntegrationError(error),
});
```

Dispose it during page cleanup. Use `setSubject(...)` rather than creating overlapping controllers when the same page switches subject.

## 4. Subject and page context

`CapabilitySubject` is intentionally small:

```ts
interface CapabilitySubject {
  type: string;
  id: string;
  category?: string;
}
```

Use identifiers from the customer application. Do not expose demo IDs or accept arbitrary browser subject selection without checking that the authenticated principal may access that subject on the server.

The transport response includes the server's authoritative subject ID and version. Browser callbacks attach that context to each invocation; the server still reloads it.

## 5. Capability registration

Wrap existing application functions in `WebMcpToolDefinition` descriptors and register them in `CapabilityRegistry`:

```ts
const registry = new CapabilityRegistry()
  .register(inspectAlertDescriptor)
  .register(isolateApprovedEndpointDescriptor);
```

Each descriptor supplies a stable name, description, classification, Zod input/output schemas, optional applicability and policy requirements, and an application handler. Duplicate names throw `DuplicateCapabilityError`.

Keep vendor and workflow semantics in application-owned descriptors and adapters, not in the browser reconciler.

## 6. Server adapter

Compose the reusable server boundary:

```ts
const enforcement = new CapabilityEnforcementService(
  registry,
  authoritativeStateProvider,
  capabilityPolicy,
  exactApprovalAndReplayAuthorizer,
);

const capabilities = new CapabilityHttpAdapter(enforcement, principalResolver);
```

Framework routes call:

- `capabilities.discover(requestContext, subject)` for `{status, body}`;
- `capabilities.invoke(requestContext, request)` for `{status, body}`.

Translate these framework-neutral results into the framework's HTTP response type. The current Next.js demo routes are specialized compatibility routes and do not yet use the generic adapter directly.

## 7. Principal resolution

Implement `PrincipalResolver<RequestContext>` on the server:

```ts
const principalResolver: PrincipalResolver<Request> = {
  async resolve(request) {
    const session = await requireApplicationSession(request);
    return {
      id: session.userId,
      type: "AGENT",
      permissions: session.permissions,
      roles: session.roles,
      context: { tenantId: session.tenantId },
    };
  },
};
```

Do not derive authority from an `actorId`, permissions array, tenant ID, or role supplied in browser JSON. The reference project currently uses explicitly labeled unauthenticated demo resolvers; replace them before production use.

## 8. Authoritative state and policy

Implement `AuthoritativeStateProvider<TState>` so every discovery and invocation reads current application state. The minimum `AuthoritativeState` contains the subject, current version/state, and resolved actor. Extend it with domain-specific proposal, approval, risk, evidence, execution, and verification facts.

Implement `CapabilityPolicy<TState>` to return an allowed decision or reason for each descriptor. Policy may use permissions, subject type/category, workflow state, evidence sufficiency, proposal status, or other deterministic facts.

For `EXECUTE` and `VERIFY`, supply a `SensitiveInvocationAuthorizer`. It must reload or verify the exact approval/action relationship and replay state. A missing sensitive authorizer causes those classifications to be denied.

## 9. Human approval integration

Implement or adapt `ApprovalClient`, or use the current `HttpHumanSurfaceClient` with the existing demo routes. Decorate it so successful decisions reconcile the page immediately:

```ts
const approvals = new RefreshingApprovalClient(
  new HttpHumanSurfaceClient(),
  web,
);
```

Approval mutations include `actionId`, `proposalVersion`, and `expectedLifecycleVersion`. Modification creates a new proposal version in the reference backend; it does not silently alter an approved version.

The optional `BubbleSurfacePanel` can embed in the customer's existing page. Applications may instead retain their existing review UI and implement only the `ApprovalClient` contract.

## 10. Provider adapters

Connect application data and actions through domain ports rather than importing demo vendors into the reusable layer. Current reference ports include:

- `SecurityEventSource`
- `IdentityProvider`
- `IdentityActionExecutor`
- `IdentityVerificationSource`

The repository includes SQLite demo/local adapters, an Elastic event adapter, and Auth0 identity/action/verification adapters. A different application can implement equivalent ports for its SIEM, IAM, EDR, cloud, or internal services.

## 11. Environment configuration

The reference app documents variables in `.env.example`:

- `DATABASE_PATH`
- `SECURITY_EVENT_SOURCE=sqlite|elastic`
- `ELASTIC_ENDPOINT`, `ELASTIC_API_KEY`
- `IDENTITY_PROVIDER=demo|auth0`
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`
- `AUTH0_MANAGEMENT_AUDIENCE`, `AUTH0_ASHA_USER_ID`
- `OPENAI_API_KEY`, `OPENAI_MODEL`

Okta-shaped variables are parsed but no Okta adapter is implemented. Do not select or advertise Okta as a current provider.

Keep all provider secrets server-side. Do not place them in capability schemas or browser bundles.

## 12. Demo preparation

```sh
npm run prepare:demo:auth0
npm run prepare:demo
npm run preflight:demo
```

`prepare:demo:auth0` performs a real mutation against the configured dedicated demo Auth0 account. It strictly verifies the user ID and Asha demo email before assigning Finance Administrator. Do not run it against arbitrary production tenants. `prepare:demo` resets local control state; `preflight:demo` is read-only.

## 13. Docker

The production Dockerfile is `hi/Dockerfile`. From `hi`:

```sh
docker build -t bubblesurface .
docker run --rm -p 8080:8080 --env-file .env.local -e PORT=8080 bubblesurface
```

The image uses a multi-stage Node 22 build, `npm ci`, `npm run build`, a non-root runtime user, and `next start` bound to `0.0.0.0`. Secrets remain runtime environment variables. The image creates writable `/app/data`; mount a development volume and set `DATABASE_PATH` if local state must survive container recreation.

## 14. Google Cloud Run

The public hackathon service is `bubblesurface` in `asia-south1`:

<https://bubblesurface-236264514374.asia-south1.run.app>

From the repository root, select `hi/Dockerfile` and use `hi` as the build context. Cloud Run supplies `PORT=8080`; configure Auth0, Elastic, and OpenAI values as runtime environment variables or managed secrets.

SQLite on Cloud Run is ephemeral and instance-local. Keep maximum instances at one for a coherent hackathon demo. Durable production deployments require external persistence and multi-instance concurrency design.

## 15. Validation checklist

- Discovery returns only currently allowed descriptors.
- Invoking with an old authoritative version fails.
- Retaining a removed browser callback does not bypass server policy.
- Exact approval binds action ID and proposal version.
- Modification invalidates/supersedes the previous version.
- A repeated execution uses application idempotency/replay rules.
- Successful execution removes execution authority.
- Verification reads fresh provider state.
- Subject switching removes tools belonging to the previous subject.
- Disposal aborts all browser registrations.
- WebMCP absence does not break the host application.

In this repository, run:

```sh
npm test
npm run typecheck
npm run build
```

Real-browser WebMCP, production authentication, tenant isolation, provider sandboxes, multi-process races, and deployment behavior still require application-specific validation.

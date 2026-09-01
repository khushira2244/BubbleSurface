# BubbleSurface current-state handoff

Reconstructed from the repository on 2026-09-01 and updated after the first reusable-integration extraction on the same date. This document describes implemented code, not the aspirations in `direction.md`.

## Executive summary

BubbleSurface is currently a single-package Next.js 15 / React 19 TypeScript application named `webmcp-security-ops`. It is a cybersecurity incident/finding control-plane prototype with:

- a SQLite domain and audit store (`better-sqlite3`);
- a linear, optimistic-concurrency lifecycle shared by incidents and vulnerability findings;
- security-context read APIs;
- OpenAI Responses API-based incident reasoning that can create bounded, evidence-linked proposals but cannot approve or execute them;
- versioned human proposal review;
- policy-derived WebMCP capability exposure;
- server-side reauthorization of every WebMCP invocation;
- approved execution, replay protection, post-execution verification, and auditing;
- optional Elastic event reads and a narrow Auth0 identity/role integration;
- a nearly placeholder frontend whose browser bootstrap is hard-coded to the primary demo incident.

This remains a single application package, but it now contains reusable source-level boundaries for descriptors/registration, authoritative state and policy, server-resolved principals, generic HTTP discovery/invocation, browser reconciliation and subject switching, approval-triggered refresh, and providers. It is not yet published independently. Demo composition and initial subject selection remain application-specific.

## A. CURRENT ARCHITECTURE

### Runtime and package structure

There is one npm package, not a monorepo. Important folders are:

- `src/app`: Next.js App Router page, client WebMCP bootstrap, and API route wrappers.
- `src/server/container.ts`: eager composition root. Opening any route imports the singleton database, initializes/migrates the schema, seeds missing fixture rows, reads integration config, and constructs all services/adapters.
- `src/server/db`: SQLite connection and additive schema initialization.
- `src/server/domain/lifecycle`: generic case states, commands, transition map, repository port, concurrency-aware service, and errors.
- `src/server/domain/security`: identities, devices, sessions, privileges, assets, incidents, findings, vulnerabilities, events, evidence, aggregate context services, and fixture relationship validation.
- `src/server/domain/control-plane`: proposal, approval, execution, verification, reasoning, and audit schemas/ports plus evidence-reference validation.
- `src/server/repositories`: SQLite implementations for cases, security context, and control-plane records.
- `src/server/reasoning`: structured OpenAI reasoning orchestration and its provider client.
- `src/server/review`: proposal history and human approve/reject/modify logic.
- `src/server/execution`: approved identity action orchestration and demo SQLite mutations.
- `src/server/verification`: post-execution identity observation and lifecycle recovery logic.
- `src/server/webmcp`: tool catalog, policy, derived context, invocation guard, browser adapter, registry delta reconciler, refresh service, and WebMCP audit recorder.
- `src/server/integrations`: provider ports, SQLite adapters, Elastic event adapter, Auth0 adapter/client/executor/verifier, and factories.
- `src/server/http`: validation/error mapping and handlers used by App Router routes.
- `src/server/seed`: deterministic demo fixture, idempotent seed, and targeted reset.
- `scripts`: demo reset, Elastic synchronization, and a `tsx` Windows-platform preload.

There is no README and, before this file, no `docs` directory. `direction.md` is informal planning/history, not an accurate architecture contract (it discusses a future Okta adapter, while the implemented external identity integration is Auth0).

### Persistence model

SQLite contains:

- domain tables: `security_cases`, `lifecycle_events`, `identities`, `devices`, `assets`, `sessions`, `privileges`, `incidents`, `findings`, `vulnerabilities`, `incident_assets`, `security_events`, `evidence`;
- control-plane tables: `action_proposals` (latest/legacy projection), `action_proposal_versions` (authoritative immutable versions except status supersession), `approval_decisions`, `execution_records`, `verification_results`, `reasoning_runs`, and `audit_events`.

Schema startup uses `CREATE TABLE IF NOT EXISTS` plus `PRAGMA table_info`/`ALTER TABLE` column additions. There is no formal migration tool or migration history. WAL and foreign keys are enabled. The database path defaults to `./data/security-ops.db`.

### Lifecycle/state model

Both `INCIDENT` and `VULNERABILITY_FINDING` use the same strictly linear lifecycle:

`NEW` --`START_TRIAGE`--> `TRIAGE` --`START_INVESTIGATION`--> `INVESTIGATING` --`VALIDATE_CASE`--> `VALIDATED` --`PREPARE_RESPONSE`--> `RESPONSE_PREPARED` --`REQUEST_APPROVAL`--> `AWAITING_APPROVAL` --`START_CONTAINMENT`--> `CONTAINING` --`MARK_CONTAINED`--> `CONTAINED` --`START_VERIFICATION`--> `VERIFYING` --`MARK_RECOVERED`--> `RECOVERED` --`CLOSE_CASE`--> `CLOSED`.

Every case has an integer version. Commands require `expectedVersion`. The service checks version and expected source state; the repository repeats the version check and performs a conditional `UPDATE ... WHERE state=? AND version=?` in a transaction. Exactly one concurrent caller using the same version can succeed. A successful transition increments the version and appends a `lifecycle_events` record with command, before/after states and versions, actor, and timestamp.

There are no rollback, reopen, cancellation, failure, or branch transitions. Rejection does not move the lifecycle out of `AWAITING_APPROVAL`.

### Capability derivation

`SqliteCapabilityContextRepository.derive` joins current persisted facts at read time:

- lifecycle state/version from `security_cases`;
- incident category or a fixed `VULNERABILITY_REMEDIATION` finding type;
- evidence count (`NONE`, `PARTIAL` for one, `SUFFICIENT` for two or more);
- injected analyst permissions (default: all five permissions for everyone using this repository instance);
- latest proposal overall, its exact-version latest decision and execution;
- latest verification for that proposal action;
- one authority row per action ID, restricted to that action's maximum proposal version, with exact-version approval and execution states;
- target risk from incident/finding severity.

`evaluateCapabilities` is deterministic and evaluates all ten tools. The currently supported workflow is only `INCIDENT` + category `IDENTITY_SESSION_COMPROMISE`. Read tools require `INVESTIGATE`; preparation requires `PREPARE` and `VALIDATED`; execution requires `EXECUTE`, `CONTAINING`, a latest `PROPOSED` version with exact `APPROVED` decision, a matching action type, and no successful execution; verification requires `VERIFY` and `CONTAINED` or `VERIFYING`.

The policy treats legacy `CONTAIN_IDENTITY` as matching both execution tools, although the current reasoning schema creates only `REVOKE_SESSIONS` or `REMOVE_PRIVILEGE`.

## B. CURRENT WEBMCP FLOW

### Tool catalog

Ten tools exist:

| Tool | Class | Implemented behavior |
|---|---|---|
| `inspect_incident` | READ | Returns the local aggregate incident context. |
| `get_active_sessions` | READ | Reads the affected identity's sessions through the selected identity provider. |
| `get_device_context` | READ | Returns local device context only after proving the device belongs to the incident. |
| `check_privilege_changes` | READ | Reads provider-backed privileges and local events whose type contains `PRIVILEGE`. |
| `review_evidence_timeline` | READ | Reads events from the selected event source and evidence from SQLite/fallback. |
| `prepare_containment` | PREPARE | Validates subject-bound evidence and returns a `DRAFT`; it does **not** persist a proposal. |
| `revoke_approved_sessions` | EXECUTE | Invokes approved `REVOKE_SESSIONS` execution. |
| `remove_approved_privilege` | EXECUTE | Invokes approved `REMOVE_PRIVILEGE` execution. |
| `verify_containment` | VERIFY | Verifies exact action targets are no longer active. |
| `verify_identity_state` | VERIFY | Verifies identity existence, target inactivity, and preservation of at least one active trusted-device session. |

All inputs contain `subjectId` and `expectedLifecycleVersion`. Device reads add `deviceId`; preparation adds requested actions/evidence references; execute/verify tools add `actionId`, `proposalVersion`, and an 8-200 character `idempotencyKey`.

### Registration, refresh, and removal

The registration mechanisms now share one reconciliation engine:

1. **Server-composed path:** `CapabilityRefreshService` loads authoritative context, evaluates desired tool names, and delegates added/retained/removed work to `BrowserCapabilityReconciler`. It records registration/unregistration audits. Browser registration calls `document.modelContext.registerTool(tool, {signal})`. Each tool gets a dedicated `AbortController`; re-registering the same name aborts the previous controller. Unregistration aborts that signal and deletes the controller. JSON Schema is generated from Zod. READ registrations alone receive `readOnlyHint: true`.

2. **Actual page bootstrap:** `WebMcpBootstrap` uses reusable `BubbleSurfaceWeb` with `HttpCapabilitySnapshotTransport`. It refreshes periodically and after invocations, supports explicit refresh and lifecycle-safe `setSubject`, keeps retained registrations on current context, and fully disposes registrations. The initial demo subject remains `INC-1001` pending UI.

Dynamic reconciliation is active in the shipped bootstrap. Server-side invocation revalidation remains the authority and protects calls made during any refresh window.

### Invocation-time stale/discovered-tool protection

The stale browser registry is not trusted. Every POST goes through `ToolInvocationService`:

1. validate tool name and tool-specific input with Zod;
2. derive fresh authoritative incident capability context from SQLite;
3. require exact `expectedLifecycleVersion`, otherwise audit and throw `STALE_CAPABILITY_CONTEXT`;
4. for EXECUTE tools, locate the current max-version authority for the supplied action ID;
5. reject a supplied non-current proposal version as `STALE_PROPOSAL_APPROVAL`;
6. require exact latest `PROPOSED` + exact-version `APPROVED` + not already succeeded + matching action type, otherwise `EXACT_APPROVAL_REQUIRED`;
7. re-run the general capability policy and reject any currently locked tool;
8. audit the call and execute/validate the output.

This protects previously discovered tools from use after a lifecycle, proposal, approval, or execution change. The HTTP layer uses actor `browser-agent`; the browser cannot choose another actor through this endpoint.

### Browser availability behavior

If `document.modelContext.registerTool` is absent, the adapter reports unavailable and the page shows `WebMCP: unsupported` without crashing. The API endpoints remain usable independently.

## C. HUMAN APPROVAL / EXECUTION FLOW

### Proposal creation and versions

The persisted proposal-producing path is the reasoning service, not `prepare_containment`. It snapshots local context plus the selected event timeline, hashes the input, asks the OpenAI Responses API for strict structured output, parses it, rejects unsupported action types, validates every evidence reference against the subject, validates target IDs against incident sessions/privileges, rechecks lifecycle version after the model returns, records the reasoning run, and creates one version-1 action per model-proposed action.

Action IDs are deterministic only relative to a random reasoning-run UUID (`ACT-AI-` + truncated SHA-256). Versions are rows keyed by `(action_id, proposal_version)`. A companion `action_proposals` table is upserted as a latest projection but does not store rationale/evidence/version.

Human modification is allowed only on the latest, reviewable version at the supplied lifecycle version. It validates replacement target IDs against the incident, marks the old version `SUPERSEDED`, and inserts version + 1 as `PROPOSED` with the modifying actor as creator. Old decisions remain as history but do not authorize the new version. `WITHDRAWN` is modeled but no service/API creates it.

### Human approval

Approve/reject/modify remain POST APIs. Reusable contracts require a server-resolved `ResolvedPrincipal`. Demo routes use explicit unauthenticated demo principal resolvers and ignore submitted actor identity; `DemoAnalystResolver` maps those resolved demo IDs to permissions. There is still no authenticated session or cryptographic identity binding.

Approval/rejection requires:

- actor has `APPROVE`;
- requested proposal is the latest version;
- supplied lifecycle version equals current lifecycle version;
- proposal status is `PROPOSED` and no execution exists for that exact version;
- referenced evidence is still valid;
- lifecycle is `AWAITING_APPROVAL`.

The decision record explicitly stores `(actionId, proposalVersion)`. Approval immediately executes lifecycle command `START_CONTAINMENT`, moving version 6 `AWAITING_APPROVAL` to version 7 `CONTAINING` in the demo flow. Rejection records a decision but does not transition state. Identical approval retries return the existing deterministic decision; a different decision on a version with any prior human decision is blocked.

The approval decision ID hashes decision kind, action ID, version, and actor. Exact authority is always looked up by both action ID and proposal version. Modification supersedes the approved old version and makes the new version unapproved, removing execution capability.

### Execution

Only the two execute WebMCP tools call `ActionExecutionService`; there is no separate direct execution API. Execution independently rechecks actor `EXECUTE`, exact `CONTAINING` state/version, subject/action relationship, latest proposal version, exact action type, exact approval, previous successful execution, and that every target is still related to the incident.

It writes an `IN_PROGRESS` record before calling the provider. `REVOKE_SESSIONS` changes only approved session IDs; `REMOVE_PRIVILEGE` changes only approved privilege IDs. On provider success it transitions `CONTAINING` to `CONTAINED`, updates the record to `SUCCEEDED`, and returns the new lifecycle. On provider failure it records `FAILED`, keeps the lifecycle in `CONTAINING`, emits failure audits, and exposes a generic 502 provider failure.

Demo execution mutates SQLite. With Auth0 selected, privilege removal maps only `PRV-ASHA-FINADMIN` to the Auth0 role named `Finance Administrator`; session revocation still uses the demo SQLite executor.

### Idempotency/replay protection

Execution records have a partial unique index on non-empty `idempotency_key`. The service checks the key first. An identical retry (same action, version, subject, and action type) returns the existing record and current lifecycle without re-executing. Incompatible reuse throws `IDEMPOTENCY_CONFLICT`. Separately, any prior successful execution for the version blocks a new key as `ALREADY_EXECUTED`. Repository insertion also returns a record already stored for the key, which gives a second layer for a race, although it does not verify compatible payload at repository level.

Verification has its own partial unique idempotency index. An identical retry by action/version/verification type returns the existing result with `duplicate: true`; incompatible reuse throws `VERIFICATION_IDEMPOTENCY_CONFLICT`. Subject identity is not included in this replay compatibility comparison, though later authority would normally bind the action to the subject on a fresh request.

Approval duplicate handling is deterministic by decision/action/version/actor-derived ID and an explicit exact-kind lookup, but there is no database unique constraint preventing concurrent duplicate decision inserts.

### Verification

Verification requires actor `VERIFY`, lifecycle `CONTAINED` or `VERIFYING` at the exact supplied version, the latest exact proposal, its exact approval, and a successful execution of that exact version. First verification from `CONTAINED` transitions to `VERIFYING` before observing fresh provider state.

- `VERIFY_CONTAINMENT` succeeds when every approved session/privilege target is observed non-active and none remains active.
- `VERIFY_IDENTITY_STATE` succeeds when the identity exists, approved targets are inactive, and at least one active session remains on a locally trusted device.

Every result stores expected/observed state, success, action/version/execution IDs, source, timestamps, failure classification, actor, and idempotency key. A failed result leaves the incident in `VERIFYING`. Recovery occurs only when two distinct successful verification types exist for the exact proposal version; then `MARK_RECOVERED` moves the lifecycle to `RECOVERED`. Closure remains a separate lifecycle command/API.

The Auth0 verifier reads the configured user and roles freshly but merges those with demo SQLite sessions/trusted devices; only the mapped finance privilege status is externally observed.

### Audit records and event vocabulary

`audit_events` stores subject, actor type/id, event type, action/version/execution/lifecycle IDs, source, JSON metadata, and timestamp. Implemented audit event types are:

- WebMCP registry/invocation: `WEBMCP_TOOL_REGISTERED`, `WEBMCP_TOOL_UNREGISTERED`, `WEBMCP_TOOL_CALLED`, `WEBMCP_TOOL_BLOCKED`.
- Review: `ACTION_PROPOSAL_REVIEWED`, `ACTION_APPROVED`, `ACTION_REJECTED`, `ACTION_MODIFIED`, `APPROVAL_BLOCKED`.
- Execution: `EXECUTION_REQUESTED`, `EXECUTION_STARTED`, `EXECUTION_SUCCEEDED`, `EXECUTION_FAILED`, `EXECUTION_BLOCKED`, plus Auth0-specific `EXTERNAL_EXECUTION_REQUESTED`, `EXTERNAL_EXECUTION_SUCCEEDED`, `EXTERNAL_EXECUTION_FAILED`.
- Verification: `VERIFICATION_REQUESTED`, `VERIFICATION_STARTED`, `VERIFICATION_PASSED`, `VERIFICATION_FAILED`, `VERIFICATION_BLOCKED`, `INCIDENT_RECOVERED`, plus `EXTERNAL_VERIFICATION_PASSED` and `EXTERNAL_VERIFICATION_FAILED`.

Lifecycle transitions are audited separately in `lifecycle_events`. Reasoning has `reasoning_runs`, but the reasoning service does not append corresponding `audit_events`. Proposal creation itself also has no explicit audit event; the proposal and reasoning-run rows are the record.

## D. GENERIC CORE VS DEMO-SPECIFIC CODE

### Relatively generic/reusable pieces

- lifecycle types/map/service/repository port and optimistic concurrency pattern;
- control-plane schemas and repository/service ports;
- evidence-reference validation concept;
- provider interfaces (`SecurityEventSource`, `IdentityProvider`, `IdentityActionExecutor`, `IdentityVerificationSource`);
- tool metadata/definitions shape, Zod-to-JSON-Schema registration, registry reconciliation, abort-signal unregister adapter;
- fresh context + policy + invocation guard architecture;
- proposal-version/exact-approval pattern;
- execution/verification record shapes and idempotency mechanisms;
- structured reasoning client and bounded-output validation pattern;
- standardized HTTP error concepts.

### Demo/application-specific pieces

- all seeded Northstar/Asha/Kavya/Rohan/Mira data and fixed IDs;
- only identity-session-compromise incidents receive WebMCP tools;
- tool catalog and action semantics are identity containment-specific;
- policy's hard-coded incident category and action matching;
- browser subject `INC-1001` and actor `browser-agent`;
- permission model and `DemoAnalystResolver`;
- default all-permission capability context;
- SQLite mutation executor/verifier;
- Auth0 mapping from local `IDN-ASHA` / `PRV-ASHA-FINADMIN` to one configured Auth0 user and role name;
- Elastic index `bubblesurface-security-events` and sync script restricted to `INC-1001`;
- verification rule that a trusted local session must remain;
- Next.js routes/composition and singleton SQLite process model;
- fixtures auto-seeded at runtime import.

### External adapters/providers

- **SQLite security event source:** search by subject/identity/time with a clamped 1-500 limit; also supplies local evidence.
- **Elastic security adapter:** indexes/searches security event documents in `bubblesurface-security-events`; evidence still comes from the SQLite fallback. It throws a minimal HTTP-status error and has no retry/pagination/circuit breaker.
- **SQLite identity adapter:** local identity, active sessions, and privileges.
- **Auth0:** client-credentials token cache, Management API user/role reads and role removal, upstream error classification, narrow identity/privilege projection, action executor, and verifier. It supports only one mapped demo user/role; session execution remains local.
- **OpenAI Responses API:** strict JSON-schema incident assessment. The current local environment has an API key/model configured.
- **Okta:** configuration fields exist, but there is no Okta adapter/factory/client implementation.

Current checked local mode (values redacted): `IDENTITY_PROVIDER=auth0`; OpenAI is configured with model `gpt-5.6`; Elastic endpoint/key are present, but `SECURITY_EVENT_SOURCE` is absent and therefore defaults to `sqlite`. `.env.example` defaults to demo identity, SQLite events, and model `gpt-5.4`.

## E. FRONTEND STATUS

The UI is a single unstyled page containing only:

- `WebMCP Security Operations backend foundation`;
- WebMCP support status;
- registered tool count;
- an error message if bootstrap fails.

There is no investigation workspace, incident/evidence display, proposal list/history, approval/reject/modify UI, execution trace, verification view, authentication UI, navigation, styling, or overview. Human review currently requires direct API use. The browser bootstrap itself now performs live capability reconciliation as described in section B.

## API endpoints

All routes are Next.js App Router handlers:

- `POST /api/incidents` and `POST /api/findings`: create lifecycle-only cases from `{title}`. They do not create matching domain incident/finding rows, so their context APIs cannot resolve them.
- `GET /api/incidents/{id}`, `/context`, `/events`, `/evidence`.
- `GET /api/findings/{id}`, `/context`.
- `GET /api/identities/{id}/context`, `/sessions`, `/privileges`.
- `POST /api/incidents/{id}/commands/{command}` and the finding equivalent. Slugs: `start-triage`, `start-investigation`, `validate`, `prepare-response`, `request-approval`, `start-containment`, `mark-contained`, `start-verification`, `mark-recovered`, `close`.
- `POST /api/incidents/{id}/reason`.
- `GET /api/incidents/{id}/proposals`.
- `GET /api/actions/{actionId}` and `/history` (identical handler/output).
- `POST /api/actions/{actionId}/approve`, `/reject`, `/modify`.
- `GET /api/actions/{actionId}/executions`, `/verifications`.
- `GET /api/executions/{executionId}` and `/api/verifications/{verificationId}`.
- `GET /api/webmcp/capabilities/{subjectId}` and `POST /api/webmcp/invoke/{toolName}`.

There are no APIs to list all cases, read audit events/lifecycle history/reasoning runs, withdraw proposals, execute outside WebMCP, configure providers/policies/actors, or refresh/push browser capabilities.

## Scripts and setup

- `npm run dev`, `build`, `start`, `typecheck`, `test`.
- `npm run reset:demo`: refuses production, initializes the schema, restores missing fixture rows, and transactionally resets only `INC-1001` lifecycle/control-plane state plus Asha's fixture sessions/privileges. It preserves unrelated subjects. It is destructive for that subject's proposals, approvals, executions, verifications, reasoning, audit, and lifecycle history.
- `npm run seed:elastic`: reads only SQLite events for hard-coded `INC-1001` and PUT-upserts them into hard-coded index `bubblesurface-security-events`; requires Elastic environment values.
- `tsx-platform-preload.cjs`: works around `os.userInfo()` failure on Windows/sandboxed execution for the reset script.
- There is no install/setup/migration script beyond npm install, schema-on-import, and automatic seed-on-container-import.

## F. TEST STATUS

On 2026-09-01:

- `npm test`: **23 files, 91 tests, all passed**.
- `npm run typecheck`: **passed**.
- `npm run build`: **passed** with Next.js 15.5.24; `/` was statically generated and all documented API routes were emitted as dynamic routes.

Important proven invariants include:

- complete linear lifecycle mapping, invalid-state rejection, optimistic concurrency, and reuse for findings;
- idempotent fixture seeding and relationship integrity;
- connected incident/finding reads and typed HTTP failures;
- subject-bound evidence validation and persisted proposal/idempotency contracts;
- strict reasoning output, evidence and target validation, and failed-run persistence;
- exact-version approval, deterministic duplicate approval, stale lifecycle/version and permission rejection, supersession invalidating old approval, and rejection never unlocking execution;
- capability exposure by state/permission/action type, removal after success, and verification exposure;
- registry delta idempotence and abort-signal removal;
- authoritative invocation revalidation, stale discovered-tool rejection, and WebMCP audits;
- exact-target execution, lifecycle transition, replay/conflict handling, provider-failure persistence, and absence of mutation on blocked calls;
- two-check recovery, failed verification persistence, verification replay, and execution authority requirement;
- Elastic document/auth behavior and SQLite fallback;
- Auth0 token caching, stable role mapping, exact role removal, error classification, fresh verification, and HTTP provider routing;
- OpenAI Responses structured-output request shape and safe upstream diagnostics;
- deterministic targeted demo reset.

Notably untested: the actual React bootstrap in a real browser/modelContext implementation, page reload/refresh behavior, end-to-end Next.js HTTP flow with a real browser agent, real OpenAI/Elastic/Auth0 credentials, multi-process SQLite races, schema upgrades from older production databases, authentication/authorization, and production deployment.

## G. RISKS / TECHNICAL DEBT

1. **Authentication is absent, although the connector trust boundary is now correct.** Reusable APIs consume only a server-resolved principal. Demo routes deliberately use fixed unauthenticated demo principals, and capability context still defaults to broad demo permissions. Integrating applications must resolve principals from their own authenticated server context.
2. **Demo subject selection is still hard-coded.** Live reconciliation is wired into React, but the page initializes only `INC-1001`; a real integration must select the current subject and dispose/reinitialize on subject changes.
3. **Hard-coded demo subject and mappings.** UI and Elastic sync use `INC-1001`; Auth0 supports only Asha and one finance role; policy supports one incident category.
4. **Generic-looking creation APIs produce incomplete aggregates.** New incident/finding POSTs create only `security_cases`, so read/context/capability flows fail without separate domain-row creation that has no API.
5. **Lifecycle and review are not transactionally unified.** Approval decision/audits are written before `START_CONTAINMENT`; a lifecycle failure can leave an approved decision without the transition. Execution provider mutation occurs before `MARK_CONTAINED`; a transition failure can leave external state changed while the execution is recorded failed. Verification similarly spans several non-atomic writes.
6. **External action atomicity is impossible and compensation/reconciliation is absent.** There is no durable outbox, job worker, retry policy, provider operation ID, uncertain-outcome reconciliation, or compensation path. `UNKNOWN` status is modeled but not actively used.
7. **Idempotency has race/semantic gaps.** Repository race fallback does not compare payload compatibility. Approval lacks a unique decision constraint. Verification replay comparison omits subject and actor. Provider idempotency keys are not passed to Auth0 because the execution interface operates on arrays and the Auth0 executor does not expose provider-native idempotency.
8. **Proposal status semantics are incomplete.** `WITHDRAWN` exists without behavior. Rejected proposals remain `PROPOSED` with rejection represented only in decisions. Modifying an already approved proposal while lifecycle is `CONTAINING` is allowed by current service checks, superseding authority but leaving lifecycle containing with no path back to approval.
9. **Multiple proposals can create awkward lifecycle coupling.** Approving one moves the incident to `CONTAINING`; other proposals can no longer be approved in the required `AWAITING_APPROVAL` state. Capability context's top-level proposal is only the latest row across the subject, while `proposalAuthorities` handles per-action latest versions.
10. **Verification has assumptions and a duplication shortcut.** Identity-state verification requires a remaining active trusted local session, which is application policy, not generic correctness. The recovery calculation concatenates the just-saved `result` to a list that already includes it; the `Set` avoids false recovery, but it is suspicious duplication.
11. **Provider integration is hybrid.** Auth0 privilege state is external, but sessions/trusted devices and most identity facts remain SQLite. Elastic supplies events only; evidence remains SQLite. This is a demo bridge, not authoritative end-to-end integration.
12. **SQLite/process architecture limits production use.** Singleton local DB, schema-on-startup, no migrations, no tenant boundary, no retention, no encryption strategy, no connection lifecycle, and no distributed coordination.
13. **Audit is append-only by convention only.** No tamper evidence, signing/hash chaining, export, query API, retention, or access controls. Some important operations (reasoning/proposal creation) lack audit events.
14. **Tool outputs are weakly typed.** Several outputs use `z.unknown()`, reducing client contract guarantees. `prepare_containment` is named as preparation but only returns an unpersisted draft.
15. **Error/format and code quality consistency are uneven.** Several recently added files are minified onto single lines; HTTP envelopes vary (`{data}`, raw object, `{context,tools}`); route IDs are not uniformly validated; read endpoints expose broad internal domain objects.
16. **No README or operational/deployment documentation.** The prior planning note mentions Okta, but only dormant Okta env validation exists; this can mislead maintainers.
17. **No frontend human-control surface.** Despite the architecture requiring human approval, the current human must call APIs directly.
18. **The demo HTTP route remains closed to ten names.** The reusable registry and `CapabilityHttpAdapter` accept arbitrary capability IDs and generic policies, but the existing demo route intentionally retains its closed Zod enum for backward compatibility. Integrating applications mount the generic adapter in their server framework.

No literal `TODO`/`FIXME` markers were found in source, but the gaps above are observable implementation incompleteness rather than comments.

## Hard-coded assumptions and fixture inventory

- primary subject `INC-1001`, category `IDENTITY_SESSION_COMPROMISE`, owner/approver `analyst-kavya`;
- WebMCP actor `browser-agent`;
- identities `IDN-ASHA`, `IDN-ROHAN`, `IDN-MIRA` and Northstar example data;
- exact session/privilege/device/asset/evidence IDs, including suspicious session `SES-ASHA-SUSPICIOUS` and privilege `PRV-ASHA-FINADMIN`;
- privileged actors limited to `analyst-kavya` and `browser-agent`;
- Auth0 user mapping via `AUTH0_ASHA_USER_ID`, role name `Finance Administrator`, and local privilege `PRV-ASHA-FINADMIN`;
- one fixed Elastic index and one-subject sync;
- only two executable action types;
- lifecycle version embedded into proposal parameters;
- fixtures dated 2025/2026 and auto-inserted on application startup;
- initial fixture cases: `INC-1001` and `FIND-2001` at `INVESTIGATING` v3, `INC-1002` and `INC-1003` at `TRIAGE` v2, `FIND-2002` at `NEW` v1.

## H. WHAT SHOULD BE DONE NEXT

The next phase should first turn the prototype into a stable integration boundary, without expanding demo features:

1. Define a public BubbleSurface core contract: subject loader, lifecycle strategy, actor/principal and permission resolver, capability policy provider, tool/action descriptors, proposal store, executor/verifier ports, audit sink, and registration transport. Move these into a framework package independent of Next.js and the Asha fixture.
2. Replace body-supplied actors/default-all permissions with authenticated principals and server-derived tenant/subject authorization. Bind browser registration and invocation to a signed/session-scoped capability context.
3. Wire a real client refresh controller: refresh after review/execution/verification/lifecycle changes, handle stale 409 responses by fetching a new snapshot, reconcile deltas, and unregister all tools on subject/session change. Do not rely on reload.
4. Make policy and catalogs extensible rather than closed enums/hard-coded category checks. Provide namespaced tool IDs, schemas, action-to-tool bindings, and application-supplied decisions.
5. Define transactional/durable orchestration boundaries: unique approval constraints, durable operation state, outbox/jobs, provider request IDs, `UNKNOWN` reconciliation, retries, and recovery after process failure. Clarify where external side effects and lifecycle transitions commit.
6. Separate domain aggregate creation from lifecycle-only creation, or remove the misleading endpoints. Add tenant/application/subject IDs throughout storage.
7. Normalize versioned proposal status/decision semantics, withdrawal/cancellation, rejection lifecycle behavior, multiple simultaneous actions, and modification-after-approval behavior.
8. Strengthen idempotency fingerprints to cover canonical full input, subject, actor/tenant, tool/action/version, and provider operation; enforce database uniqueness for decisions and other single-authority records.
9. Make verification policies application-supplied and explicitly tied to action descriptors; avoid demo-specific trusted-session rules in core.
10. Add formal migrations, audit query/export/tamper evidence, observability, retention, secrets/deployment guidance, and integration conformance tests.
11. Build a minimal real UI for subject selection, evidence/proposal review, approval/rejection/modification, capability status, invocation/audit trace, execution, and verification.
12. Add end-to-end tests in a WebMCP-capable browser, plus real-provider sandbox tests and multi-process/race/failure-injection tests.

Another cybersecurity application can now supply arbitrary capability descriptors, authoritative state/policy, sensitive authorization, approval implementation, provider ports, and an HTTP/browser transport without importing the demo providers or fixture. Remaining adoption friction is packaging and the lack of a generic ready-made HTTP adapter: the integration currently consumes source modules from this application package. There is still no published library, authentication contract, tenant isolation, migration package, or broad conformance suite. See `docs/integration-architecture.md` for the current integration contract.

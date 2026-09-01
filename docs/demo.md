# BubbleSurface demo runbook

## Current readiness note

The backend scenario, WebMCP integration controller, Elastic/Auth0 adapters, and reusable human surface exist. The current `/demo` route is intentionally only a placeholder, and the landing page does not mount `WebMcpBootstrap`. Therefore this runbook describes the repository-supported proof sequence, but the complete browser recording cannot yet be performed from `/demo` until the next task composes the real demo page with `BubbleSurfaceWeb` and `BubbleSurfacePanel`.

Do not imply in a submission video that the current placeholder is an interactive demo.

## Reference scenario

- Subject: `INC-1001`
- Supported workflow: `IDENTITY_SESSION_COMPROMISE`
- Evidence source: Elastic when `SECURITY_EVENT_SOURCE=elastic`; otherwise SQLite.
- Identity/action source: Auth0 when `IDENTITY_PROVIDER=auth0`; otherwise demo SQLite behavior.
- WebMCP discovery: `GET /api/webmcp/capabilities/INC-1001`
- WebMCP invocation: `POST /api/webmcp/invoke/:toolName`

Every tool payload includes the current `subjectId` and `expectedLifecycleVersion`. Execute and verify tools additionally require `actionId`, `proposalVersion`, and a unique `idempotencyKey` of 8–200 characters.

## Group 1 — Initial capability discovery

**Goal:** Prove that the page exposes investigation capabilities but not consequential execution.

**Page state:** After `npm run reset:demo`, `INC-1001` is restored to its seeded `INVESTIGATING` state. Read the current incident before relying on an expected version.

**Expected WebMCP capabilities:**

- `inspect_incident`
- `get_active_sessions`
- `get_device_context`
- `check_privilege_changes`
- `review_evidence_timeline`

`prepare_containment`, both execution tools, and both verification tools are not yet allowed.

**Relevant request:** `GET /api/webmcp/capabilities/INC-1001`.

**Site Tools / WebMCP:** The five read tools should be discoverable when the future demo page mounts `BubbleSurfaceWeb`. Sensitive tools should be absent, not merely disabled in visual UI.

**DevTools Network:** One capability snapshot request returning `context.lifecycleVersion` and the five tool descriptors.

**Resulting state:** No mutation. Lifecycle remains `INVESTIGATING`.

## Group 2 — Investigation

**Goal:** Show the external agent collecting bounded evidence through structured tools.

**Page state:** `INVESTIGATING`, with Elastic supplying the evidence timeline when configured.

**Expected WebMCP capabilities:** The same five read capabilities.

**Relevant calls:**

- `inspect_incident`
- `get_active_sessions`
- `get_device_context` with a related `deviceId`
- `check_privilege_changes`
- `review_evidence_timeline`

Calls go to `POST /api/webmcp/invoke/:toolName`. Use related identifiers returned by the incident/context tools; unrelated device targets are rejected.

**Site Tools / WebMCP:** Read capabilities remain present during investigation.

**DevTools Network:** Invocation POSTs followed by capability refresh GETs. The refresh after invocation is performed by `BubbleSurfaceWeb`.

**Resulting state:** Evidence has been read; the tools themselves do not advance lifecycle state.

## Group 3 — Prepare consequential action

**Goal:** Produce a bounded action proposal tied to current evidence without executing it.

**Page state:** Advance the incident from `INVESTIGATING` to `VALIDATED` using `POST /api/incidents/INC-1001/commands/validate` with the current `expectedVersion` and demo `actorId`. At `VALIDATED`, `prepare_containment` becomes available.

**Expected WebMCP capabilities:** Five reads plus `prepare_containment`. Execution and verification remain absent.

**Relevant calls:**

- `prepare_containment` with `requestedActions` (`REVOKE_SESSIONS` and/or `REMOVE_PRIVILEGE`) and valid `evidenceRefs`. This capability returns a validated `DRAFT`; it does not persist a proposal.
- `POST /api/incidents/INC-1001/reason` is the current route that runs configured reasoning and persists AI-created proposal records. It requires `OPENAI_API_KEY`; an optional `expectedVersion` may be supplied.
- To make a proposal human-reviewable, use the real lifecycle routes in order: `POST /api/incidents/INC-1001/commands/prepare-response`, then `POST /api/incidents/INC-1001/commands/request-approval`, each with the current version.

**Site Tools / WebMCP:** `prepare_containment` appears only at `VALIDATED`. After leaving that state it disappears during reconciliation.

**DevTools Network:** The lifecycle command, preparation invocation, reasoning request if used, subsequent lifecycle commands, and capability refreshes should be visible separately.

**Resulting state:** An exact persisted proposal is available and the incident reaches `AWAITING_APPROVAL`. No provider action has occurred.

## Group 4 — Human approval

**Goal:** Show that a human decision changes agent-visible authority.

**Page state:** `AWAITING_APPROVAL`; the reusable panel displays the latest exact proposal version.

**Expected WebMCP capabilities before approval:** Read tools; no execution capability.

**Relevant call:** `POST /api/actions/:actionId/approve` with:

```json
{
  "proposalVersion": 1,
  "expectedLifecycleVersion": 6,
  "comment": "Reviewed against current evidence."
}
```

The numbers above are illustrative only: use the actual proposal and lifecycle versions returned in this run. The server ignores a submitted demo `actorId` for authority and resolves the labeled demo review principal.

Reject uses `/reject`. Modify uses `/modify`, supersedes the current version, and requires fresh approval.

**Site Tools / WebMCP:** With `RefreshingApprovalClient`, successful approval immediately refreshes the capability snapshot. The execution tool matching the exact approved action appears: `revoke_approved_sessions`, `remove_approved_privilege`, or both for a matching `CONTAIN_IDENTITY` proposal.

**DevTools Network:** Approval POST followed by `GET /api/webmcp/capabilities/INC-1001`.

**Resulting state:** Approval advances the incident to `CONTAINING`. The proposal is approved; it has not executed.

## Group 5 — Execute approved action

**Goal:** Invoke only the capability authorized by the exact approved proposal and change provider state.

**Page state:** `CONTAINING`, current lifecycle version, latest approved proposal not previously succeeded.

**Expected WebMCP capability:** The action-matching execution tool.

**Relevant call:** `revoke_approved_sessions` or `remove_approved_privilege` with the exact `actionId`, `proposalVersion`, current `expectedLifecycleVersion`, and a fresh `idempotencyKey`.

**Site Tools / WebMCP:** The execution capability is present before the call. After successful execution and refresh, it disappears.

**DevTools Network:** Invocation POST, provider request on the server (not exposed as a browser credential-bearing request), then capability refresh GET. Auth0 is the external action target when configured for the supported privilege-removal mapping; session revocation remains the demo executor in the current hybrid integration.

**Resulting state:** A successful execution record is persisted and lifecycle advances to `CONTAINED`. Repeating the same compatible idempotency key returns the prior record; conflicting reuse is rejected. A second successful execution is blocked.

## Group 6 — Verify authoritative result

**Goal:** Confirm the provider-observed result rather than assuming an execution response is sufficient.

**Page state:** `CONTAINED` initially, then `VERIFYING` after the first verification begins.

**Expected WebMCP capabilities:**

- `verify_containment`
- `verify_identity_state`

Execution tools remain absent.

**Relevant calls:** Both verification tools use the exact action/proposal, current lifecycle version, and independent idempotency keys.

**Site Tools / WebMCP:** Verification capabilities appear after execution. After both verification kinds pass and lifecycle reaches `RECOVERED`, the current policy removes them.

**DevTools Network:** Verification invocation POSTs and capability refresh GETs. Provider observation occurs server-side. With Auth0, privilege state is freshly observed there; other demo identity facts may still come from SQLite because the reference integration is intentionally hybrid.

**Resulting state:** Each verification result is persisted with expected and observed state. When both verification kinds pass for the exact proposal version, lifecycle advances to `RECOVERED`.

## Before recording

- [ ] Build the real `/demo` composition page; the current route is only a placeholder.
- [ ] Mount `BubbleSurfaceWeb` for the selected subject and dispose it on cleanup.
- [ ] Connect `BubbleSurfacePanel`, `HttpHumanSurfaceClient`, and `RefreshingApprovalClient`.
- [ ] Run `npm run reset:demo` and note the returned state/version.
- [ ] Configure and validate `OPENAI_API_KEY` if the recorded flow uses `/reason` to create proposals.
- [ ] Set `SECURITY_EVENT_SOURCE=elastic` plus `ELASTIC_ENDPOINT`/`ELASTIC_API_KEY` and run `npm run seed:elastic` if Elastic must be shown.
- [ ] Set `IDENTITY_PROVIDER=auth0` and all required Auth0 variables if the supported external privilege action must be shown.
- [ ] Confirm the proposal selected by reasoning uses an action/target supported by the configured provider path.
- [ ] Confirm the browser actually exposes `document.modelContext.registerTool` and Site Tools sees the page registrations.
- [ ] Open DevTools Network and preserve logs.
- [ ] Use returned versions; do not hard-code the illustrative version in this runbook.
- [ ] Prepare unique idempotency keys for execution and each verification.
- [ ] Rehearse the exact capability appearances/disappearances once before recording.
- [ ] Do not expose provider credentials, authorization headers, `.env` files, or personal browser data in the recording.

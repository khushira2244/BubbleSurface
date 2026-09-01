# BubbleSurface human surface

## A. Purpose

The human surface is a compact intervention and control panel for security workflows mediated by BubbleSurface. It is not a dashboard, agent chat, browser inspector, or vendor console. It appears when human visibility or exact authority is useful and answers five questions quickly:

1. What is happening?
2. Does the agent need a human decision?
3. What exact proposal version is being approved, rejected, or modified?
4. What happened after the decision?
5. Was the resulting state verified?

The components are generic. They contain no fixed incident, identity, location, role, Elastic, or Auth0 assumptions.

## B. UI responsibilities versus agent/WebMCP responsibilities

The UI owns presentation of authoritative activity and state, proposal review controls, concise modification, loading/failure feedback, and immediate post-mutation reload.

The UI does not run or impersonate the external agent. WebMCP discovery, capability reconciliation, invocation authorization, action execution, verification, exact approval, and replay protection remain in the frozen connector/control plane. Activity entries describe persisted or application-supplied authoritative observations; they do not claim that an agent runs inside the panel.

## C. Component structure

The public component module is `src/components/bubblesurface/index.ts`:

- `BubbleSurfacePanel`: composable root in `embedded` or `standalone` mode.
- `AgentActivity`: latest authoritative agent-originated activity.
- `StatusBadge`: text plus shape/color status indication.
- internal proposal summary and `HumanReviewCard`: action, subject, rationale, version, parameters, decision state, and review controls.
- `ExecutionStatus`: none, pending, in progress, succeeded, failed, or unknown.
- `VerificationStatus`: none, pending, verifying, passed, or failed, including individual checks.
- `ActivityTimeline`: chronological `AGENT`, `HUMAN`, and `SYSTEM` entries.
- `HttpHumanSurfaceClient`: thin adapter over existing proposal, execution, verification, and review routes.
- `HumanReviewController`: performs a review mutation and then reloads the authoritative UI model.

Styles use a local CSS module so embedding does not require global application styling. Controls use native buttons, inputs, labels, and textareas for keyboard accessibility.

## D. View model and state mapping

`HumanSurfaceModel` deliberately isolates components from demo/backend row shapes:

```ts
interface HumanSurfaceModel {
  subject: { id: string; type: string; label: string; title?: string };
  status: HumanSurfaceStatus;
  proposal?: HumanSurfaceProposal;
  execution: HumanSurfaceExecution;
  verification: HumanSurfaceVerification;
  activity: HumanSurfaceActivity[];
  updatedAt: string;
}
```

Supported top-level states are:

- `IDLE`
- `AGENT_ACTIVE`
- `HUMAN_REVIEW_REQUIRED`
- `APPROVED`
- `REJECTED`
- `SUPERSEDED`
- `EXECUTING`
- `EXECUTION_SUCCEEDED`
- `EXECUTION_FAILED`
- `VERIFYING`
- `VERIFIED`
- `VERIFICATION_FAILED`
- `STALE`

`deriveHumanSurfaceStatus` gives stale/superseded and failure states precedence, then verification, execution, approval, review requirement, and finally agent-active/idle. It does not create backend transitions; it summarizes existing records.

`mapControlPlaneToHumanSurface` adapts the current action-history, execution, and verification read models. Other applications can build `HumanSurfaceModel` directly from their own read model.

## E. Approval flow

The panel accepts an `ApprovalClient` and a `reload` function. In the intended composition, the client is already decorated by `RefreshingApprovalClient`:

```ts
const rawApprovalClient = new HttpHumanSurfaceClient();
const approvalClient = new RefreshingApprovalClient(rawApprovalClient, bubbleSurfaceWeb);

<BubbleSurfacePanel
  mode="embedded"
  model={model}
  approvalClient={approvalClient}
  reload={() => rawApprovalClient.loadModel(subject, actionId)}
/>
```

On approval or rejection:

1. the exact action ID, proposal version, and lifecycle version are submitted;
2. `RefreshingApprovalClient` refreshes WebMCP immediately after successful server mutation;
3. `HumanReviewController` reloads the authoritative human view model;
4. the component updates immediately;
5. failures leave the existing model intact and show a safe message.

Buttons display busy states and are disabled while a mutation is running. If no client is supplied, the review card is intentionally read-only.

## F. Modify and supersede flow

Modification is deliberately lightweight: one rationale field and a JSON-object parameter editor for the meaningful action fields supported by the application review API.

The panel states before saving that modification creates a new version, supersedes the visible version, and requires fresh approval. After success it reloads the server result, displays the latest version, and returns to `HUMAN_REVIEW_REQUIRED`. Stale or superseded proposals never render decision controls.

The JSON editor is an application-neutral fallback. A consuming product can wrap or replace the review card with action-specific fields while retaining `HumanReviewController` and the same exact-version mutation contract.

## G. Execution and verification flow

Execution and verification are read-only in the human panel. Agents invoke authorized WebMCP capabilities through the control plane; the UI reflects authoritative results.

Execution displays pending/in-progress/succeeded/failed/unknown states and a safe provider failure message when available. Verification displays pending/verifying/passed/failed and textual per-check outcomes, so status never relies on color alone.

The panel does not add execution or verification transitions. It maps current records into display states.

## H. Embedded mode

`mode="embedded"` removes the elevated standalone treatment, narrows the maximum width, and keeps the panel suitable for a side rail or contextual drawer inside another security product. Responsive rules collapse metadata and status columns on narrow viewports.

The host application owns placement, subject selection, authenticated principal resolution, and model loading.

## I. Standalone and demo reuse

`mode="standalone"` uses the same components with a slightly wider card and restrained elevation. A later hackathon demo page can compose:

- its scenario-specific incident/evidence workspace;
- `BubbleSurfaceWeb` for the current subject;
- one generic `BubbleSurfacePanel` for human intervention;
- demo-specific adapters that supply labels and activity without putting those assumptions into the component library.

No scenario shell or demo data was added in this task.

## J. Remaining work for the hackathon demo page

The demo page should next provide:

1. scenario-specific subject and evidence context;
2. a current action/proposal selection strategy;
3. composition of `BubbleSurfaceWeb`, `RefreshingApprovalClient`, `HttpHumanSurfaceClient`, and `BubbleSurfacePanel`;
4. authoritative activity loading, including WebMCP audit events if the demo wants a richer trace;
5. clear labeling that fixed demo principals are unauthenticated;
6. polished page layout around the reusable panel, without changing connector or human-surface contracts.

The current backend lacks a generic combined activity-feed endpoint. That is not a blocker: the demo can initially adapt existing proposal/execution/verification records, and add a thin audit read endpoint only if the final trace needs events that those records cannot represent.

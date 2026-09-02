# BubbleSurface demo runbook

This runbook exercises the public golden path on one `/demo/live` page. The host page shows persistent incident state, `BubbleSurfacePanel` handles the human decision, optional toasts announce important events, and the WebMCP inspector proves the machine-visible capability surface.

## Scenario

| Item | Demo value |
| --- | --- |
| Incident | `INC-1001` |
| Affected user | Asha Mehta |
| Identity | `IDN-ASHA` |
| Reviewer | Kavya / `analyst-kavya` |
| Suspicious session | `SES-ASHA-SUSPICIOUS` |
| Sensitive privilege | `PRV-ASHA-FINADMIN` |
| Auth0 role | Finance Administrator |

Elastic supplies the event timeline when configured. Auth0 supplies current privilege state, receives the real role-removal mutation, and is queried again during verification. SQLite holds the reference lifecycle and control records.

## Prepare a local demo

Configure `.env.local` from `.env.example`, then run:

```sh
npm run prepare:demo:auth0
npm run prepare:demo
npm run preflight:demo
```

- `prepare:demo:auth0` validates the configured Auth0 user ID and exact demo email before idempotently assigning Finance Administrator.
- `prepare:demo` resets `INC-1001`, its fixture, proposals, approvals, executions, verifications, audit records, and lifecycle.
- `preflight:demo` performs read-only readiness checks. Continue only when it prints `READY: true`.

Never use the Auth0 preparation script against an arbitrary or production identity. It is intentionally restricted to the dedicated Asha demo account.

## Public demo

- Application: <https://bubblesurface-236264514374.asia-south1.run.app>
- Live workspace: <https://bubblesurface-236264514374.asia-south1.run.app/demo/live>
- Demo video: **Coming shortly**

Cloud Run's SQLite database is instance-local and ephemeral. Keep maximum instances at one for the hackathon demo and prepare/reset the intended instance before recording.

## Golden-path rehearsal

All WebMCP inputs use the current `subjectId` and `expectedLifecycleVersion`. Execute and verify calls also use the returned `actionId`, exact `proposalVersion`, and a new 8–200 character `idempotencyKey`.

### 1. Start at investigation

Open `/demo/live`. Confirm lifecycle `INVESTIGATING` at demo version 3, Investigate is current, Finance Administrator is `ACTIVE`, and the browser exposes `inspect_incident`, `get_active_sessions`, `get_device_context`, `check_privilege_changes`, and `review_evidence_timeline`.

### 2. Complete the evidence boundary

Invoke `review_evidence_timeline` with current version 3. Evidence is returned, lifecycle becomes `VALIDATED` version 4, `prepare_containment` appears, the host page moves to Review, and the investigation toast appears once.

### 3. Prepare containment

Invoke `prepare_containment` using current version 4 and the evidence-backed `REMOVE_PRIVILEGE` action. A typed proposal is persisted for `PRV-ASHA-FINADMIN`; lifecycle reaches `AWAITING_APPROVAL` version 6; execution remains unavailable; and `BubbleSurfacePanel` opens for review.

### 4. Approve the exact proposal

In `BubbleSurfacePanel`, review and approve the exact action/version. The server resolves `analyst-kavya`; the browser does not supply review authority. Lifecycle becomes `CONTAINING` version 7, `remove_approved_privilege` appears, and Execute becomes current.

Reject and Modify remain valid alternatives. Reject prevents execution. Modify supersedes the displayed proposal and requires approval of the new exact version.

### 5. Execute against Auth0

Invoke `remove_approved_privilege` with version 7, the approved action/version, and a fresh idempotency key. The dedicated Auth0 user's Finance Administrator role is removed, execution is persisted, lifecycle becomes `CONTAINED` version 8, execution disappears, verification tools appear, and the provider-backed identity card changes to `REVOKED`.

### 6. Verify identity state

Invoke `verify_identity_state` with version 8 and a new idempotency key. Auth0 is read again. Lifecycle becomes `VERIFYING` version 9; identity verification reads `PASSED`; containment verification remains `PENDING`; and the incident is not recovered.

### 7. Verify containment

Invoke `verify_containment` with version 9 and a new idempotency key. Both required verification kinds are now persisted as passed, lifecycle becomes `RECOVERED` version 10, sensitive execution/verification capabilities disappear, and the workspace shows the final recovered outcome.

The version numbers above are deterministic demo and concurrency details, not user-facing workflow concepts.

## Recording checklist

- Stay on `/demo/live`; do not reload or navigate between stages.
- Use the normal workspace for the human story and the inspector only for capability proof.
- Use `BubbleSurfacePanel` for the exact approval.
- Show Finance Administrator changing from active to revoked.
- Pause after the first verification to prove partial verification is not recovery.
- Finish on the recovered header and persistent containment outcome.
- Confirm polling does not duplicate toasts.

## Safe negative demonstrations

A stale lifecycle version, wrong proposal version, execution before approval, incompatible reuse of an idempotency key, or invocation of a retained stale callback should produce a structured server denial without broadening browser capabilities.

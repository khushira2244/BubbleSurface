# Inspiration

AI agents working with cybersecurity products should not receive a permanent, unrestricted toolbox. Security authority changes with the live incident: new evidence arrives, permissions differ by actor, proposals are revised, approvals expire, actions execute, and verification changes what should happen next.

WebMCP provides a useful page-level surface for structured tools, but exposing a tool is only the beginning. A security application still needs to decide which capabilities should exist now—and whether a capability discovered moments ago is still authorized when it is invoked.

BubbleSurface addresses that gap. It gives security agents only the capabilities they are allowed to use right now, while humans retain authority over consequential actions.

# What it does

BubbleSurface is a reusable, state-aware, human-governed WebMCP capability and control layer for existing cybersecurity applications. It turns application-owned security actions into dynamic capabilities that an external WebMCP-capable agent can discover on the live page.

The public workflow is simple:

**Investigate → Propose → Human approve → Execute → Verify**

In the reference demo, Elastic supplies security evidence and history. BubbleSurface initially exposes investigation capabilities, allowing the external agent to inspect the incident, sessions, devices, privilege changes, and the evidence timeline. The agent can then prepare a bounded containment proposal, but sensitive execution capabilities remain absent.

The human uses a small BubbleSurface intervention surface embedded in the security product. They review the exact proposal version and may approve, reject, or modify it. Approval changes machine-visible authority: the exact approved execution capability appears in WebMCP.

When the agent invokes that capability, the server reloads authoritative state and revalidates permissions, lifecycle version, proposal version, exact approval, applicability, and replay state. The reference action updates Auth0-backed identity state. After execution, the execution capability disappears and verification capabilities appear. Verification then reads fresh authoritative state to confirm the result.

The external agent is not part of BubbleSurface. The customer application retains its page, users, authentication, data, domain semantics, and security functions; BubbleSurface governs how those functions become agent-accessible capabilities.

# How we built it

## Browser

`BubbleSurfaceWeb` is the browser controller. It detects the page WebMCP API, fetches the current capability snapshot, and reconciles desired registrations against the tools already present. Added tools are registered, removed tools are unregistered through their registration lifecycle, and retained tools stay stable. It supports explicit refresh, interval fallback, refresh after invocation, safe subject switching, and complete disposal on page cleanup.

## Server

`CapabilityRegistry` stores application-owned capability descriptors. `CapabilityHttpAdapter` provides a framework-neutral discovery and invocation boundary, while `PrincipalResolver` derives trusted identity and permissions from server request context. Authoritative state and policy are reloaded for invocation; input and output are schema-validated; expected versions are enforced; sensitive execution and verification require an additional authorizer.

The reference demo adds strict exact-proposal approval, action matching, execution-state, idempotency/replay, audit, and verification checks. Browser discovery is never accepted as authorization.

## Human control

The reusable `BubbleSurfacePanel` is designed to embed inside an existing security product rather than replace it with another dashboard. It presents agent activity, exact proposal details, approve/reject/modify controls, execution state, verification state, and an activity timeline. `ApprovalClient` keeps the UI independent of the backend implementation. `RefreshingApprovalClient` refreshes `BubbleSurfaceWeb` immediately after a successful decision so human approval changes the agent-visible surface without waiting for the polling fallback.

## Adapters

The integration boundaries are vendor-neutral. The repository includes SQLite local/demo implementations, an Elastic security-event source, and Auth0 identity, privilege-action, and verification adapters. Elastic and Auth0 are reference integrations, not dependencies of the reusable browser, registry, HTTP adapter, or enforcement contracts.

## Testing

The current suite contains 91 automated tests and the production build and TypeScript checks pass. Tests cover capability policy, browser registration removal and reconciliation, subject changes, stale discovered-capability rejection, proposal supersession and approval invalidation, exact execution, idempotency behavior, verification, audit behavior, provider adapters, and the human-intervention surface.

The repository does not yet contain a real-browser WebMCP end-to-end suite, so we do not claim that coverage.

# Challenges we ran into

- **Separating discovery from authorization.** A browser tool declaration is useful for an agent, but it cannot be treated as proof that an invocation is still allowed.
- **Removing authority safely.** An execution capability must disappear from the page after use, while the server must still reject an agent that retained an older callable reference.
- **Binding approval exactly.** Approval belongs to one action and one proposal version. Modification supersedes the old proposal and requires fresh approval.
- **Keeping the core reusable.** Elastic, Auth0, fixed identities, and the incident demo had to stay outside the reusable WebMCP contracts.
- **Making human control compact.** We needed visible human authority without turning BubbleSurface into a new security dashboard.
- **Building on a new browser surface.** WebMCP support is still limited enough that feature detection, graceful unavailability, and conservative claims are important.

# Accomplishments that we're proud of

- A capability surface that changes with authoritative security state.
- Exact human approval that unlocks only the intended proposal version.
- Server-side protection against stale or retained browser capabilities.
- Automatic removal of an execution capability after successful use.
- Fresh post-action verification instead of assuming execution succeeded.
- Reusable browser, server, principal, approval, provider, and human-UI boundaries.
- Real Elastic and Auth0 reference adapters alongside local demo adapters.
- 91 focused automated tests across the control plane and integration boundaries.

# What we learned

The most interesting part of WebMCP is not exposing more tools; it is controlling when capabilities should exist. An absent capability—or a clear, machine-readable refusal—can be more important than adding another tool.

Human approval also needs to change machine-visible authority. A confirmation modal alone is not sufficient if the agent's actual capability set remains unchanged.

Most importantly, security authority belongs in deterministic server state, not in prompts. The browser helps an agent discover what appears possible; the server decides what is allowed at the moment of invocation.

# What's next for BubbleSurface

- Package the browser and server modules as installable SDKs.
- Add more security provider adapters and workflows.
- Integrate production authentication, authorization, tenancy, and policy configuration.
- Strengthen durable execution with outbox and reconciliation patterns.
- Support richer reusable capability and policy descriptors.
- Add production audit export, observability, and operational controls.
- Add real-browser WebMCP end-to-end coverage and broaden supported browser environments.

These are future directions; the current repository is a working reference implementation, not a published SDK or production multi-tenant service.

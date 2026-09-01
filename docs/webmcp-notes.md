# WebMCP implementation notes

These notes separate the browser behavior used by this repository from BubbleSurface's own control-layer decisions. They are technical implementation notes, not a complete or normative description of WebMCP.

## 1. What WebMCP / Site Tools provides

In the browser API targeted by this repository, a live page can register structured tools for discovery and invocation by a compatible external agent. A registration includes a name, description, JSON input schema, optional annotations, and an execution callback.

The repository does not vendor a WebMCP specification, pin a specification revision, or include an authoritative browser-support matrix. Claims here are therefore limited to the API shape implemented and tested by BubbleSurface.

## 2. Page-level registration

BubbleSurface targets the current document's model context:

```ts
document.modelContext.registerTool(tool, { signal });
```

The internal adapter checks that `document.modelContext.registerTool` is a function before attempting registration. If unavailable, `BubbleSurfaceWeb` reports `WEBMCP_UNAVAILABLE` and leaves the application usable without browser tools.

## 3. Registration input

`BrowserToolRegistration` contains:

```ts
interface BrowserToolRegistration {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute(input: unknown, options?: { signal?: AbortSignal }): Promise<unknown> | unknown;
}
```

The server converts Zod schemas to JSON Schema for discovery. The current demo marks only `READ` capabilities with `readOnlyHint: true`.

## 4. Current-page lifecycle

BubbleSurface treats registrations as owned by the live page integration. It creates them after initialization, reconciles them while the subject/state changes, and removes all of them when the integration is disposed. React navigation or unmount is expected to call `dispose()`.

This lifecycle ownership is a BubbleSurface design choice around the page API; it is not a claim that WebMCP itself defines the application's security lifecycle.

## 5. Registration and removal lifecycle

`ExperimentalBrowserWebMcpAdapter` stores one `AbortController` per tool name. Registration passes the controller's signal to `registerTool`. Unregistration aborts that signal and removes the controller. Re-registering the same name first aborts the previous controller.

`BrowserCapabilityReconciler` compares currently registered and desired names:

- added names are registered;
- removed names are unregistered;
- retained names are left untouched;
- `dispose()` unregisters every tracked name.

## 6. Discovery is not authorization

A registered tool only tells an external agent that a capability was available for the page's last reconciled snapshot. It does not prove the invocation is currently authorized.

The page may be stale, state may have changed elsewhere, or an agent may retain an old callback after the tool has disappeared. For this reason, BubbleSurface routes invocation to the server and reloads authoritative state every time.

## 7. Dynamic reconciliation

`BubbleSurfaceWeb.refresh()` obtains a capability snapshot through `CapabilitySnapshotTransport`, builds browser registrations, and delegates the name delta to `BrowserCapabilityReconciler`.

Refresh occurs:

- during `BubbleSurfaceWeb.init()`;
- explicitly through `refresh()`;
- after each browser tool invocation;
- after a successful approval mutation when using `RefreshingApprovalClient`;
- on an optional interval as fallback;
- after `setSubject(...)` changes page context.

Concurrent calls share the active refresh promise. Subject switching aborts an active fetch, waits for the superseded refresh to settle, clears its current context, and fetches the new subject.

## 8. State and version handling

The discovery response includes an authoritative context with `subjectId` and `lifecycleVersion`. A registered callback overlays those values onto invocation input before calling the transport.

The generic `CapabilityEnforcementService` reloads `AuthoritativeState`, compares its version with `expectedVersion`, evaluates current policy, and rejects a mismatch with `AUTHORITATIVE_VERSION_MISMATCH`. The demo specialization performs equivalent lifecycle checks and additional proposal/action checks.

The snapshot version is a concurrency guard, not authorization by itself.

## 9. Stale invocation behavior

An earlier-discovered capability can fail safely at invocation time. Depending on the path, the HTTP boundary returns a structured stale-version, capability-denied, stale-approval, validation, or domain execution/verification error. The demo routes use `409` for stale lifecycle, stale approval, and no-longer-allowed capability cases.

The registered callback refreshes in `finally`, so both successful and failed invocations prompt a new reconciliation when the integration remains active.

## 10. Human approval and immediate refresh

`RefreshingApprovalClient` decorates an `ApprovalClient`. After `approve`, `reject`, or `modify` succeeds, it awaits `BubbleSurfaceWeb.refresh()`. Failed mutations do not refresh through the decorator.

Approval does not directly register an execution tool. It mutates authoritative server state; the subsequent refresh derives the now-valid capability set from that state. This preserves the server as the source of authority.

## 11. External agent versus BubbleSurface services

The external WebMCP-capable agent is not part of BubbleSurface. BubbleSurface contains:

- the page integration and registration lifecycle;
- capability transport and server enforcement boundaries;
- application-supplied descriptors and handlers;
- principal, state, policy, approval, provider, execution, verification, and audit integrations;
- an optional embedded human-intervention UI.

The external agent discovers and invokes page tools. BubbleSurface does not host, prompt, or orchestrate that agent.

## 12. Testing strategy

Unit and integration tests use fake browser adapters and fake `modelContext.registerTool` implementations to prove:

- graceful behavior when the API is unavailable;
- registration signals and abort-based removal;
- added/retained/removed reconciliation;
- refresh, subject switching, mutation refresh, and disposal;
- server revalidation of stale discoveries;
- capability policy and exact approval transitions.

The current repository does not include a real-browser WebMCP end-to-end test. It also does not test a browser extension or Site Tools UI automatically.

## 13. Limitations and browser support

- Runtime support is feature-detected rather than assumed.
- The repository targets the `document.modelContext.registerTool` shape shown above.
- No browser-version compatibility table is maintained in the repository.
- No polyfill is provided when WebMCP is absent.
- Interval refresh is fallback polling; there is no push subscription for external state changes.
- Browser tests are adapter-level rather than real-agent end-to-end tests.

## 14. Repository references

- `src/server/webmcp/browser-webmcp.adapter.ts` — feature detection and signal-owned registrations.
- `src/server/webmcp/browser-capability-reconciler.ts` — added/retained/removed application.
- `src/server/webmcp/bubble-surface-web.ts` — application-facing page controller.
- `src/server/webmcp/capability-http.adapter.ts` — generic server discovery/invocation boundary.
- `src/server/webmcp/capability-enforcement.service.ts` — authoritative revalidation.
- `src/server/webmcp/approval-refresh.client.ts` — approval-triggered refresh.
- `docs/integration-architecture.md` — BubbleSurface integration boundary.
- `docs/current-state-handoff.md` — full implementation inventory and known limitations.

No official external WebMCP references were already recorded in the repository at the time these notes were written. Add authoritative specification and browser documentation links during final submission review rather than guessing them here.

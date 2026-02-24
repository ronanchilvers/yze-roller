# Decisions

- **2026-02-14 — Character import schema and validation**
  - **Context:** Importing character JSON with `attribute_*` and `skill_*` fields, canonical skills defined by mapping file. Attributes are required and must be integers ≥ 1; skills default to 0 if missing or empty.
  - **Decision:** Enforce required attributes and integer-only dice values. Treat missing/empty skill values as 0 without failing import. Ignore non-canonical skills.
  - **Consequences:** Imports fail fast on missing/invalid attributes; skill omissions are resilient and do not block import. Users can still roll skills with 0 dice.
  - **Alternatives considered:** Treat missing skills as validation errors (rejected to keep imports forgiving).

- **2026-02-14 — UI flow for imported rolls**
  - **Context:** Dice Pool panel now includes manual and import tabs.
  - **Decision:** Import tab auto-selects the mapped attribute when a skill is chosen and locks attribute selection while a skill is selected. Imported roll uses attribute + skill counts; push actions defer to the existing primary action behavior.
  - **Consequences:** Fewer mismatched skill/attribute rolls and a consistent push workflow across tabs.
  - **Alternatives considered:** Allow manual attribute override even when a skill is chosen (rejected to avoid rule violations).

- **2026-02-14 — Display name formatting**
  - **Context:** Character identity fields may be partial in JSON.
  - **Decision:** Display name format is `firstname "nickname" lastname`, with sensible fallbacks to available parts and a generic label if absent.
  - **Consequences:** User-facing name is consistent and readable even with incomplete data.
  - **Alternatives considered:** Use only `firstname lastname` (rejected because nickname was preferred).

  - **2026-02-14 — Import UI quick-roll and simplified controls**
    - **Context:** Import tab needed faster roll access and a cleaner layout.
    - **Decision:** Replace attribute/skill dropdowns with clickable counts in the import summary for quick rolls, keep the JSON upload field always visible, and remove the import tab roll button. Split roll and push actions so “Roll Dice” always starts a new roll and “Push X Dice” is a separate action.
    - **Consequences:** Import tab is simpler and quicker to use; roll behavior is explicit and avoids accidental pushes.
    - **Alternatives considered:** Keep dropdown-based rolls and a shared roll/push button (rejected for clarity and speed).

- **2026-02-16 — Dark mode includes system preference**
  - **Context:** The app needed dark mode support without forcing users to manually switch when their OS theme changes.
  - **Decision:** Implement a 3-way theme preference (`system`, `light`, `dark`) persisted in localStorage, with `system` as default and runtime resolution via `prefers-color-scheme`.
  - **Consequences:** Theme follows OS automatically by default while still allowing user overrides; styles are maintained via CSS token overrides rooted at `:root[data-theme="..."]`.
  - **Alternatives considered:** Manual light/dark toggle only (rejected because it ignores OS preference changes).

- **2026-02-18 — Toast mechanism strategy for roll results**
  - **Context:** Roll outcomes are currently announced inline in `src/App.jsx` (`trayLead` / `tray-results`), and a reusable toast pattern already exists in `ronanchilvers/fate-cards` (`src/components/toast` + `useToast`).
  - **Decision:** Adopt the Fate Cards toast architecture (provider, container, hook, timer cleanup, fallback API) and route Year Zero roll-result announcements through toasts while preserving push/clear controls and history tracking.
  - **Consequences:** Result feedback becomes transient and reusable across future UI flows; integration requires careful dedupe to avoid repeated toasts per render and accessibility tuning to avoid duplicate live announcements.
  - **Alternatives considered:** Keep inline-only result display (rejected for lower reuse and weaker cross-feature notification consistency).

- **2026-02-18 — Source-agnostic roll-event ingestion for toasts**
  - **Context:** Future multiplayer/API support may deliver roll results from remote players rather than local roll resolution only.
  - **Decision:** Define a normalized roll-event adapter and route both local and remote events through one shared toast emission path with id/key dedupe.
  - **Consequences:** Toast behavior remains consistent across event sources and is resilient to replayed/duplicate remote events; additional helper tests are required for malformed external payloads.
  - **Alternatives considered:** Directly trigger toasts from each source path (rejected due to duplicated logic and higher drift risk).

- **2026-02-18 — Roll toast defaults and queue policy**
  - **Context:** Open implementation choices remained for toast display mode, duration, actor labeling, queue overflow handling, and confirm API scope.
  - **Decision:** Use `diceResult` mode for roll outcomes, default duration `10000ms`, source-agnostic ingestion layer required now, remote label based on `actorId`, and pending queue policy of 20 items with oldest-first dropping. Defer confirm API usage for now.
  - **Consequences:** Roll-result presentation is consistent and fixed for initial delivery; queue behavior under bursty remote events is deterministic; upstream systems still own how `actorId` is represented to users.
  - **Alternatives considered:** `alert` mode for roll results, shorter duration defaults, and summarized/drop-newest overflow policies.

- **2026-02-18 — Move push/clear controls into the main panel and remove tray results UI**
  - **Context:** With toast-based roll feedback in place, the old tray results/history panel duplicated result messaging while still owning push/clear controls.
  - **Decision:** Remove the tray results panel from `App` and render `Push X Dice` plus `Clear Dice` controls in `DicePoolPanel` footer, side-by-side on desktop and stacked on mobile.
  - **Consequences:** Layout is simpler, controls stay in the primary panel regardless of tab, and redundant inline result/history UI is eliminated.
  - **Alternatives considered:** Keep tray panel only for controls (rejected to avoid a split interaction surface).

- **2026-02-18 — Clamp imported skill dice to Year Zero limits**
  - **Context:** Character import accepted canonical skill values above expected table limits, while invalid/malformed values were already reset to 0.
  - **Decision:** Accept imported skill dice only when the value is an integer between 0 and 10 inclusive; otherwise reset that skill to 0 and keep import valid with a warning.
  - **Consequences:** Imported skill pools now stay within expected game bounds and malformed/out-of-range inputs are handled safely without aborting import.
  - **Alternatives considered:** Hard-fail import on out-of-range values (rejected to preserve forgiving import behavior).

- **2026-02-18 — Defer manual dice input normalization until roll**
  - **Context:** Immediate normalization in manual input change handlers forced fallback values while users were editing, making it hard to clear and replace numbers.
  - **Decision:** Keep manual input fields as draft strings and run normalization/commit only when the manual `Roll Dice` action is triggered.
  - **Consequences:** Users can clear and retype values naturally; persisted pool counts and roll execution still use normalized numeric bounds.
  - **Alternatives considered:** Keep on-change normalization and rely on cursor UX workarounds (rejected due to poor editing ergonomics).

- **2026-02-22 — Finalize API implementation via contract-first closure**
  - **Context:** Client and server multiplayer docs define major flows but left implementation-critical gaps (request/response schema details, cursor semantics, actor identity authority, and GM management completeness).
  - **Decision:** Use a contract-first readiness checklist as the implementation gate, requiring closure of all documented blockers before API build sign-off.
  - **Consequences:** Reduces client/server drift and prevents partial endpoint implementation from hardcoding assumptions that later break polling, auth, or event consistency.
  - **Alternatives considered:** Implement endpoints directly from outlines and refine later (rejected due to high rework and integration risk).

- **2026-02-22 — Single-source API contract with role-specific runbooks**
  - **Context:** Implementation work needed one agent-friendly spec that both client and server tracks could follow without diverging endpoint behavior.
  - **Decision:** Create a canonical multiplayer API contract document as source of truth, then align client and server implementation docs as execution runbooks that reference the canonical contract.
  - **Consequences:** Endpoint schemas, auth semantics, event behavior, and tests are now defined once and consumed consistently; v1 deferrals (manual scene strain set, timeout leave events) are explicit.
  - **Alternatives considered:** Keep separate client/server specs as independent sources of truth (rejected due to synchronization drift risk).

- **2026-02-22 — Store `joining_enabled` in `session_state`**
  - **Context:** `session_state` was updated to a generic key/value component list and would otherwise overlap with `sessions.session_joining_enabled`.
  - **Decision:** Make `session_state` authoritative for both `scene_strain` and `joining_enabled`, with `state_value` string encoding and explicit type conversion rules (`\"true\"/\"false\"` for `joining_enabled`).
  - **Consequences:** Avoids dual-write drift between tables; join authorization and session snapshot behavior now depend on parsed `session_state` values.
  - **Alternatives considered:** Keep `joining_enabled` in `sessions` while using `session_state` only for strain (rejected due to split state authority).

- **2026-02-23 — Use build-time Vite env for API base URL with safe fallback**
  - **Context:** Client-side API integration needs environment-specific endpoint targeting while avoiding hardcoded URLs across join/session/poll/action paths.
  - **Decision:** Centralize endpoint configuration in `src/lib/app-config.js` using `import.meta.env.VITE_API_BASE_URL`; enforce non-empty string values when provided, normalize trailing slashes, and default to same-origin `"/api"` when unset.
  - **Consequences:** Future API client code can compose request URLs from one validated source; deployments can switch API targets per build mode without touching feature logic.
  - **Alternatives considered:** Hardcode `"/api"` only (rejected because staging/production splits may require different origins), runtime-injected global config (deferred unless one artifact must serve multiple environments).

- **2026-02-23 — Normalize API request/response handling in a shared client**
  - **Context:** Client implementation steps require consistent bearer-token auth, error envelope parsing, and deterministic status/code/message handling across join/bootstrap/poll/action requests.
  - **Decision:** Add `src/lib/api-client.js` as the single fetch abstraction: compose URLs via app config, attach bearer headers when token exists, parse JSON on 2xx responses, treat `204` as no-content, and throw `ApiClientError` with envelope-derived `code/message` or `HTTP_<status>` fallback.
  - **Consequences:** Later client flows can consume one stable transport contract and centralize retry/auth UX behavior around normalized errors.
  - **Alternatives considered:** Parse each endpoint inline in hooks/components (rejected because it duplicates envelope handling and increases drift risk).

- **2026-02-23 — Add dedicated `/join` route flow with memory-only auth handoff**
  - **Context:** Contract-aligned client flow needs fragment-token join handling and session-token handoff before snapshot bootstrap/polling are implemented.
  - **Decision:** Route `/join` paths to a dedicated `JoinSessionView`, parse `#join=<token>` from URL hash, call `/api/join` through the shared API client, normalize success payload into in-memory auth (`sessionToken`, `sessionId`, `role`, `self`), clear the hash fragment, and navigate out of `/join`.
  - **Consequences:** Join-token and session-token concerns are decoupled from main gameplay UI, and future bootstrap polling work can read auth from one in-memory store.
  - **Alternatives considered:** Keep join behavior embedded in `App` without route/view split (rejected due to coupling and harder testing).

- **2026-02-23 — Introduce normalized `/api/session` bootstrap state hook**
  - **Context:** The client requires a deterministic bootstrap step after join success to seed `sinceId`, player roster, scene strain, and role before polling begins.
  - **Decision:** Add `useMultiplayerSession` as the bootstrap boundary that reads in-memory auth, fetches `/api/session`, normalizes payloads via `normalizeSessionSnapshot`, and maps auth failures to `auth_lost` while clearing memory auth.
  - **Consequences:** Snapshot initialization is centralized and testable, reducing drift in later polling/reducer work and giving one consistent path for handling revoked/invalid session tokens.
  - **Alternatives considered:** Parse `/api/session` ad hoc inside route components (rejected due to duplicated validation and inconsistent auth-failure handling).

- **2026-02-23 — Implement polling loop semantics inside multiplayer session hook**
  - **Context:** Contract requires deterministic client polling behavior across idle periods, server/network errors, and auth invalidation while preserving `since_id` cursor progression.
  - **Decision:** Extend `useMultiplayerSession` with timer-managed polling for `/api/events` (`limit=10`) using `1000ms` base interval, `x1.5` growth to `8000ms` on `204`, exponential error backoff with jitter to `30000ms`, and immediate auth-loss shutdown (`401`/`403` + token error codes) that clears in-memory auth.
  - **Consequences:** Polling behavior is now centralized and testable; downstream reducer/UI work can consume one stream state (`events`, `sinceId`, `pollingStatus`, `pollIntervalMs`) rather than reimplementing transport semantics.
  - **Alternatives considered:** Poll inside UI components with ad hoc timers (rejected due to duplicated timer logic and weaker auth-failure guarantees).

- **2026-02-23 — Centralize multiplayer event reduction and event submit validation**
  - **Context:** Client needs deterministic updates for event stream ingestion and local action posting (`roll`/`push`) without leaking actor identity fields into request payloads.
  - **Decision:** Add `multiplayer-event-reducer` for ordered, idempotent event application (`roll`, `push`, `strain_reset`, `join`, `leave`) and extend `useMultiplayerSession` with `submitRoll`/`submitPush` that enforce local payload constraints (integers `0..99`, boolean `strain`) before posting `{ type, payload }`, then apply server-returned event/state as authoritative.
  - **Consequences:** Event handling and action submit behavior are now consistent between poll-driven and response-driven updates, reducing drift and duplicate logic in UI layers.
  - **Alternatives considered:** Inline reducer logic in hook and route components (rejected because behavior would be harder to test and easier to desynchronize).

- **2026-02-23 — Keep GM operations in the multiplayer session hook with explicit role guards**
  - **Context:** GM-only endpoints need consistent guardrails and state updates, but a dedicated GM UI surface has not been fully introduced yet.
  - **Decision:** Implement GM API methods directly in `useMultiplayerSession` (`rotateJoinLink`, `setJoiningEnabled`, `resetSceneStrain`, `refreshPlayers`, `revokePlayer`) with shared role/session/token checks and auth-failure handling, returning structured `{ ok, ... }` results for future UI composition.
  - **Consequences:** GM operations are available immediately to any UI layer with consistent behavior and test coverage, while avoiding premature coupling to a specific panel design.
  - **Alternatives considered:** Build GM endpoint calls directly into a temporary component (rejected because it duplicates guard/error handling and makes future refactors harder).

- **2026-02-24 — Introduce explicit top-level multiplayer UI modes in `App`**
  - **Context:** UI integration needed a predictable boundary for upcoming host/session/GM surfaces instead of implicitly rendering gameplay UI when route or auth state changed.
  - **Decision:** Add mode resolution in `App` across `host`, `join`, `session`, and `auth_lost`, driven by route (`/join`), in-memory auth presence, and `useMultiplayerSession().sessionState.status`; bootstrap is triggered only in `session` mode when status is `idle`.
  - **Consequences:** Host and auth-lost states now have dedicated UI shells and deterministic transitions, making subsequent Task 2+ UI work additive rather than cross-cutting.
  - **Alternatives considered:** Keep mode inference scattered across route handlers and join callbacks (rejected due to coupling and inconsistent transitions).

- **2026-02-24 — Implement host session creation as dedicated host-mode form**
  - **Context:** Task 2 required a concrete GM initialization path; host mode previously rendered only a placeholder shell with no API integration.
  - **Decision:** Add `HostSessionView` to submit `POST /api/sessions` with `session_name`, map creation errors to user-facing messages, normalize success payload (`gm_token`, `session_id`) to in-memory auth, and transition via existing mode/bootstrap logic in `App`.
  - **Consequences:** GMs can now initialize a multiplayer session from UI without manual API calls; host-to-session handoff remains centralized in `App`.
  - **Alternatives considered:** Build session creation directly inside `App` (rejected to keep host-flow concerns isolated and testable).

- **2026-02-24 — Make CSP `connect-src` configurable per environment for cross-origin API calls**
  - **Context:** The frontend CSP was fixed at `connect-src 'self'`, which blocks API requests when `VITE_API_BASE_URL` points to a different origin (for example `https://api.example.com`).
  - **Decision:** Parameterize CSP connect sources in `index.html` using `%VITE_CSP_CONNECT_SRC%`, keep `'self'` as default baseline, and define `VITE_CSP_CONNECT_SRC` in each environment file next to `VITE_API_BASE_URL`.
  - **Consequences:** Cross-origin API calls can be allowed per environment without weakening CSP globally; deployments must keep API base URL and CSP connect sources in sync.
  - **Alternatives considered:** Loosen CSP globally (`https:`/`*`) (rejected due to reduced exfiltration protection), or move CSP generation to Vite config (deferred to avoid config changes during current task flow).

- **2026-02-24 — Add invite-link parsing fallback while keeping canonical `/join#join=` intake**
  - **Context:** Players previously had only one intake path (`/join#join=<token>`), and missing-token states blocked progress unless users manually edited the URL.
  - **Decision:** Add invite-input parsing utilities for full links/hash/token strings and route all resolved tokens back through canonical `/join#join=<token>` from both host mode and join missing-token fallback.
  - **Consequences:** Player onboarding is more resilient to malformed/partial links while preserving one join API submission path and existing route semantics.
  - **Alternatives considered:** Introduce a separate non-route join endpoint in UI state (rejected to avoid duplicating join logic outside the canonical route flow).

- **2026-02-24 — Introduce a dedicated session-mode wrapper with normalized connection summary**
  - **Context:** Session mode previously rendered the dice UI directly, leaving multiplayer state (connection/polling status, role, session metadata) implicit and not visible in the interface.
  - **Decision:** Add `SessionView` as the session-mode boundary in `App`: run `bootstrapFromAuth` when token is present and state is `idle`, derive normalized connection summary text/tone, and pass a concise session summary model into `DiceRollerApp` for rendering.
  - **Consequences:** Session lifecycle is now explicit in one mode-specific wrapper, and users get immediate visibility into multiplayer status without changing existing dice mechanics.
  - **Alternatives considered:** Keep bootstrap and status rendering scattered in `App` and ad hoc UI fragments (rejected due to weaker separation and harder evolution for later event/GM panels).

- **2026-02-24 — Submit local roll/push outcomes through multiplayer APIs with UI lockout and non-fatal errors**
  - **Context:** Session mode had local dice resolution but did not yet push resulting outcomes (`roll`/`push`) into multiplayer API events, allowing local state to diverge from shared session state.
  - **Decision:** In `DiceRollerApp`, derive contract payloads from resolved local outcomes and call `submitRoll`/`submitPush` once per local action id, disable action controls while submit is pending, and render action-level submit errors without forcing session teardown.
  - **Consequences:** Local gameplay outcomes now sync to the session event stream, duplicate submits are suppressed for rerenders, and users receive actionable failure feedback while remaining in-session.
  - **Alternatives considered:** Submit directly inside `useRollSession` (rejected to keep multiplayer transport concerns out of local dice-state hook), or silently ignore submit errors (rejected due to poor operator visibility).

- **2026-02-24 — Keep mounted guard StrictMode-safe for action-submit pending transitions**
  - **Context:** Development StrictMode triggers effect cleanup/re-run cycles that can leave mount flags false if they are only set in cleanup handlers.
  - **Decision:** Ensure `isMountedRef` is set to `true` on effect mount and `false` on cleanup in `DiceRollerApp`.
  - **Consequences:** Pending-submit state can reliably transition back to idle after resolved requests in both StrictMode and non-StrictMode environments.
  - **Alternatives considered:** Remove mount guard entirely (rejected because async submit completion could update state after unmount).

- **2026-02-24 — Keep primary action label stable during submit lockout**
  - **Context:** The prior submit-lock UX changed the primary action text to `Submitting...`, which reduced clarity for your preferred interaction model.
  - **Decision:** Keep the manual action label unchanged (`Roll Dice`) while the submit lock is active and rely on disabled state plus session-level feedback for pending/error status.
  - **Consequences:** Button semantics stay stable while still preventing duplicate actions during in-flight submit calls.
  - **Alternatives considered:** Continue swapping button text during submit (rejected by UX preference).

- **2026-02-24 — Treat 204 event polls as connected-idle, not reconnecting**
  - **Context:** Connection badge logic maps `pollingStatus: backoff` to `Reconnecting`; the polling hook previously set `backoff` for both `204` idle responses and actual error backoff, causing a persistent reconnecting label during normal idle operation.
  - **Decision:** Keep `pollingStatus: running` on `204` responses (while still increasing interval), reserve `backoff` for error retry paths only, and clear transient error fields once polling succeeds again.
  - **Consequences:** Session status remains `Connected` during idle periods; `Reconnecting` now signals real retry-after-error behavior.
  - **Alternatives considered:** Add an additional polling status enum for idle (deferred; current change keeps model minimal while fixing misleading UX).

- **2026-02-24 — Add lightweight session event feed derived from authoritative event stream**
  - **Context:** Multiplayer state had connection/session summaries, but users lacked direct visibility of recent session events (`roll`, `push`, `join`, `leave`, `strain_reset`) without deeper tooling.
  - **Decision:** Render a compact event feed panel in session mode from `sessionState.events`, normalize entries to stable summaries, and key list items by `event.id` while preserving server order.
  - **Consequences:** Session activity is visible in UI with minimal overhead; feed remains deterministic and resilient to duplicate event ids.
  - **Alternatives considered:** Defer feed to a later dedicated timeline view (rejected because basic observability was needed now for multiplayer UX and debugging).

- **2026-02-24 — Surface GM endpoint actions through a role-gated session panel**
  - **Context:** GM API actions were already implemented in `useMultiplayerSession`, but there was no in-session UI to invoke them or manage player revocation.
  - **Decision:** Add a GM-only controls panel in `App` session mode with buttons for join-link rotation, joining enable/disable, scene strain reset, player refresh, and per-player revoke actions; centralize async feedback handling via one `runGmAction` helper.
  - **Consequences:** GM operational endpoints are now reachable from UI with deterministic role gating and action feedback, while non-GM players never see host controls.
  - **Alternatives considered:** Build a separate dedicated GM route/view (deferred to keep current integration incremental and reuse existing session layout).

- **2026-02-24 — Add explicit copy action for rotated GM join links**
  - **Context:** Rotated join links were visible in the GM panel but required manual selection/copy, which slowed host workflows and increased formatting mistakes.
  - **Decision:** Add a `Copy Join Link` control that uses `navigator.clipboard.writeText` when available and falls back to a hidden textarea + `document.execCommand("copy")` path when clipboard APIs are unavailable or denied.
  - **Consequences:** Hosts can copy shareable links in one action across modern and constrained environments; the panel now surfaces deterministic success/error feedback for clipboard failures.
  - **Alternatives considered:** Depend on Clipboard API only (rejected because permission/context constraints can fail in some deployment environments).

- **2026-02-24 — Add explicit retry action for session bootstrap errors**
  - **Context:** Session summary indicated connection error state, but users had no direct in-panel action to retry bootstrap after transient network/API failures.
  - **Decision:** Pass session connection metadata into `DiceRollerApp` and render an error row with server-facing error text plus a `Retry Connection` button that calls `bootstrapFromAuth`.
  - **Consequences:** Recovery from transient connection failures is now a one-click in-session action without forcing route changes or auth reset; in-flight retries are guarded to prevent duplicate bootstrap requests from rapid repeated clicks, and retry progress is exposed via a live status announcement for accessibility.
  - **Alternatives considered:** Require full-page refresh for retry (rejected due to poorer recovery UX and slower iteration while testing integrations).

- **2026-02-24 — Apply a single focus-visible treatment to secondary action buttons**
  - **Context:** Task 10 required keyboard/focus verification, and secondary buttons (`join-secondary`) were used for join/GM/retry flows without the shared custom focus ring.
  - **Decision:** Include `.join-secondary:focus-visible` in the shared focus-visible selector group in `App.css`.
  - **Consequences:** Keyboard users now get consistent, high-contrast focus affordances across primary and secondary controls.
  - **Alternatives considered:** Rely on browser default focus styles for secondary buttons (rejected for inconsistent visual contrast with the existing tokenized focus system).

- **2026-02-24 — Use multiplayer scene strain as the sole strain authority in session mode**
  - **Context:** Session mode displayed multiplayer `sceneStrain` in the summary, but top-bar `Strain Points` and roll strain dice were still driven by local `useStrainTracker`, causing diverging metrics and incorrect strain dice.
  - **Decision:** In session mode, resolve strain points from authoritative session state and pass that value into `useRollSession`; disable local bane-increment strain accumulation in session mode; route top-bar reset through GM reset action when role permits and disable it for non-GM players.
  - **Consequences:** Strain metric and dice behavior are now consistent with server-authoritative multiplayer state, and reset behavior matches role permissions.
  - **Alternatives considered:** Keep dual local/session strain paths and reconcile opportunistically (rejected due to persistent drift risk and unclear UX).

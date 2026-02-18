# Toast Alert Integration Plan

## Objective
Integrate a reusable toast mechanism modeled on `ronanchilvers/fate-cards`, route dice results through toasts, and make the result-notification path source-agnostic so it can handle both local rolls and future remote/API roll events.

## Source Implementation Reviewed (`fate-cards`)
Reviewed files:
- `/tmp/fate-cards/src/components/toast/ToastProvider.jsx`
- `/tmp/fate-cards/src/components/toast/ToastContainer.jsx`
- `/tmp/fate-cards/src/components/toast/Toast.css`
- `/tmp/fate-cards/src/components/toast/ToastProvider.test.jsx`
- `/tmp/fate-cards/src/components/toast/ToastContainer.test.jsx`
- `/tmp/fate-cards/src/hooks/useToast.js`
- `/tmp/fate-cards/src/hooks/useToast.test.jsx`
- `/tmp/fate-cards/src/main.jsx`

Patterns to mirror:
- Context-backed provider API with safe methods: `alert`, `diceResult`, `confirm`.
- Toast queue state managed in provider (`toasts`, timer cleanup, stable id generation).
- Auto-dismiss with duration + dismiss callback.
- Dedicated container component that renders by kind.
- Fallback no-op hook behavior when provider is missing.

## Current Year Zero Touchpoints
- Result/session state: `src/hooks/useRollSession.js`
- Current inline result/historical UI: `src/App.jsx`
- Current tray/result styles: `src/App.css`
- App root wiring point: `src/main.jsx`

## Scope
In scope:
- Add toast provider/container/hook infrastructure.
- Trigger toasts for completed rolls/pushes.
- Replace inline “latest result lead” as primary result announcement channel.
- Add a source-agnostic roll-event adapter that supports local and remote/API event inputs.
- Keep push/clear controls and previous-results history panel intact.

Out of scope:
- Implementing multiplayer transport, sockets, or API subscription clients.
- Refactoring unrelated app flows to use toasts.
- Adding dependencies or changing Vite config.

## Proposed File Changes
Core implementation:
- `src/components/toast/ToastProvider.jsx`
- `src/components/toast/ToastContainer.jsx`
- `src/components/toast/Toast.css`
- `src/hooks/useToast.js`
- `src/lib/roll-toast-event.js`
- `src/App.jsx`
- `src/App.css`
- `src/main.jsx`

Tests:
- `src/components/toast/ToastProvider.test.jsx`
- `src/components/toast/ToastContainer.test.jsx`
- `src/hooks/useToast.test.jsx`
- `src/lib/roll-toast-event.test.js`
- `src/App.toast-integration.test.jsx` (or equivalent focused integration test file)

## Integration Design
1. Toast API surface
- Keep `alert`, `diceResult`, and `confirm`.
- Normalize malformed input and ignore empty payloads.
- Use shared enqueue helper for timed toasts.

2. Source-agnostic roll event contract
- Create normalized event shape in `src/lib/roll-toast-event.js`:
  - `eventId?: string`
  - `source: "local" | "remote"`
  - `actorId?: string`
  - `actorName?: string`
  - `action: "roll" | "push"`
  - `successes: number`
  - `banes: number`
  - `hasStrain: boolean`
  - `occurredAt: number`

3. Event normalization and formatting
- Add pure helpers:
  - `normalizeRollToastEvent(input)`
  - `getRollToastDedupKey(event)`
  - `buildRollToastPayload(event)`
- Sanitize unknown/partial external data with non-throwing defaults.

4. Ingestion pipeline
- Local path: map resolved roll data from `useRollSession` into normalized roll event, then call shared emitter.
- Remote path: expose a single app-level entry point to receive future API events and feed same emitter.
- Do not special-case UI rendering by source beyond message text.

5. Idempotency and dedupe
- Deduplicate using `eventId` when provided.
- Fallback dedupe key for missing ids: source + actor + action + summary + timestamp bucket.
- Store recently processed keys in a `useRef(Map)` with TTL cleanup to prevent rerender/API replay duplicates.

6. Queue policy
- Maintain a pending toast buffer of up to 20 items.
- On overflow, drop the oldest pending item first.

7. Message strategy
- Local example: `Roll Result` / `Push Result`.
- Remote example: `<actorId> rolled` / `<actorId> pushed` (fallback: `Another player`).
- Body: `X successes, Y banes` plus `(with Strain)` when true.

8. Accessibility
- Keep one primary result live region channel (toasts).
- Use explicit dismiss buttons for keyboard users.
- Keep confirm mode as `alertdialog` with clear action labels.

## Testing Plan
1. Toast unit tests
- Provider lifecycle: add/remove, auto-dismiss, timer cleanup, callback behavior.
- Confirm queue behavior: one active confirm at a time, labels honored.
- Container rendering: per-kind output, explicit dismiss controls, malformed input safety.
- Hook behavior: fallback API without provider, context API with provider.

2. Roll event helper tests
- Valid local input normalization.
- Valid remote input normalization with actor fields.
- Missing/invalid fields fallback behavior.
- Dedup key stability and uniqueness behavior.
- Message payload formatting for roll vs push and strain variants.

3. Integration tests
- Local roll completion emits one toast.
- Push completion emits one toast.
- Duplicate local rerender does not emit duplicate toast.
- Simulated remote event emits toast with remote actor title.
- Duplicate remote event id is ignored.

4. Visual checks (running app)
- Roll dice: toast appears once with correct summary.
- Push dice: toast appears once with correct summary.
- History dropdown still works.
- Mobile viewport: toast remains readable and non-overlapping.
- Theme modes: toast colors remain legible in light/dark.

## Detailed Agent Task Breakdown
Each task is discrete, self-contained, and has explicit validation.

1. Task A01: Add toast constants and types
- Change: create constants for toast kinds/tones and default durations.
- Files: `src/components/toast/ToastProvider.jsx` (or `src/components/toast/constants.js` if split).
- Validation: unit tests assert only allowed kinds/tones are emitted.

2. Task A02: Implement shared timed-toast enqueue helper
- Change: add reusable helper for id creation, payload normalization, queue insertion, timer registration.
- Files: `src/components/toast/ToastProvider.jsx`.
- Validation: provider tests cover `alert` and `diceResult` using same helper path.

3. Task A03: Implement `alert` and `diceResult` in provider
- Change: wire helper to `toast.alert(...)` and `toast.diceResult(...)`.
- Files: `src/components/toast/ToastProvider.jsx`.
- Validation: provider tests for add, click dismiss, auto-dismiss, `onDismiss`.

4. Task A04: Implement confirm queue in provider
- Change: add confirm queue state and promise resolution flow.
- Files: `src/components/toast/ToastProvider.jsx`.
- Validation: provider tests confirm queued dialogs resolve in order.

5. Task A05: Build accessible toast container UI
- Change: render alert/dice/confirm modes with explicit dismiss button; ensure confirm uses configurable labels.
- Files: `src/components/toast/ToastContainer.jsx`, `src/components/toast/Toast.css`.
- Validation: container tests assert dismiss button exists and `confirmLabel` is rendered correctly.

6. Task A06: Add `useToast` hook with safe fallback
- Change: implement fallback no-op API and optional dev warning when provider missing.
- Files: `src/hooks/useToast.js`.
- Validation: hook tests for both with-provider and without-provider usage.

7. Task A07: Wire provider at app root
- Change: wrap `<App />` with `<ToastProvider>`.
- Files: `src/main.jsx`.
- Validation: visual smoke test in dev app; no runtime errors on startup.

8. Task A08: Add roll event normalization helpers
- Change: implement `normalizeRollToastEvent`, `getRollToastDedupKey`, `buildRollToastPayload`.
- Files: `src/lib/roll-toast-event.js`.
- Validation: `src/lib/roll-toast-event.test.js` covers malformed remote input and output stability.

9. Task A09: Integrate local roll events through shared emitter
- Change: in `App.jsx`, convert local roll completion into normalized event and call `toast` via shared path.
- Files: `src/App.jsx`.
- Validation: integration test verifies one toast per local roll resolution.

10. Task A10: Add remote event ingestion seam (no API client yet)
- Change: add a single app-level function/signature to ingest future API roll events and route through same normalization/emitter flow, without implementing subscription/network code.
- Files: `src/App.jsx` (and optional helper module if extracted).
- Validation: integration test with synthetic remote event verifies title/body includes remote actor and source behavior.

11. Task A11: Add dedupe cache for local and remote events
- Change: maintain recent dedupe keys with TTL using refs.
- Files: `src/App.jsx` or dedicated helper.
- Validation: integration tests verify repeated event ids/keys do not create duplicate toasts.

12. Task A12: Retire duplicate inline result live announcements
- Change: remove/reduce competing `aria-live` result lead from tray panel while preserving history UI.
- Files: `src/App.jsx`, `src/App.css`.
- Validation: visual inspection confirms tray controls/history intact; accessibility test ensures no duplicate result announcements.

13. Task A13: Theme-aware toast styling
- Change: map toast surfaces/text/borders to existing CSS variables and responsive layout rules.
- Files: `src/components/toast/Toast.css`, `src/App.css` (token additions if needed).
- Validation: visual checks in light/dark + narrow viewport.

14. Task A14: Add toast module test suite
- Change: add provider/container/hook tests.
- Files: toast test files + hook test file.
- Validation: tests pass for core toast behaviors and accessibility-critical controls.

15. Task A15: Add integration regression tests
- Change: add focused tests for local roll, push roll, remote event, and dedupe.
- Files: `src/App.toast-integration.test.jsx` (or existing app test file).
- Validation: tests pass and specifically assert no duplicate toasts.

16. Task A16: Manual QA pass
- Change: run visual QA in dev app and capture checklist outcomes.
- Files: no code required if all pass; otherwise targeted fixes in touched files.
- Validation: checklist in this plan section completed with pass/fail notes.

### A16 Checklist Outcome (2026-02-18)
Automated checks:
- `PASS` Full test suite: `npq-hero run test` (latest run: 18 files, 153 tests, exit code 0).
- `PASS` Local roll toast integration regression coverage.
- `PASS` Remote ingestion seam regression coverage.
- `PASS` Local/remote dedupe regression coverage.
- `PASS` Toast provider/container/hook unit coverage (including accessibility-oriented assertions).

Visual checks requiring local manual confirmation in the running app:
- `PENDING USER VERIFY` Roll dice shows a single toast and tray controls still work.
- `PENDING USER VERIFY` Push dice shows push summary toast and history panel still behaves correctly.
- `PENDING USER VERIFY` Toast placement/readability on small viewport.
- `PENDING USER VERIFY` Toast legibility and contrast in both light and dark themes.

## Risks and Mitigations
- Duplicate toasts from rerenders or replayed API events:
  - Mitigation: event id/key dedupe with TTL cache.
- Out-of-order external events:
  - Mitigation: use event timestamps in dedupe key strategy and avoid mutating roll history from remote toasts.
- High-frequency remote events causing toast flood:
  - Mitigation: use a pending buffer capped at 20 and drop oldest on overflow.
- Accessibility noise:
  - Mitigation: maintain a single live result announcement channel.
- Style mismatch across themes:
  - Mitigation: use existing theme tokens, not hardcoded palette.

## Confirmed Decisions
- Roll results always use `diceResult` mode.
- Initial roll-result toast duration is `10000ms` (10s).
- Confirm API inclusion is deferred for this phase; source-agnostic ingestion layer is still required.
- Remote actor label uses `actorId` (whether it is display name vs system id will be decided upstream later).
- High-volume policy uses a pending buffer of 20 and drops oldest first on overflow.

## Pre-Implementation Quality Gates
1. Confirm label correctness
- Confirm toasts must render configured `confirmLabel` and `cancelLabel`.

2. Side-effect-free state updaters
- Do not invoke callbacks from inside state updater reducers.

3. Accessible dismiss controls
- Include an explicit dismiss button for non-confirm toasts.

4. Shared timed-toast enqueue helper
- `alert` and `diceResult` must use shared helper logic.

5. Centralized toast constants
- Avoid hardcoded string kinds/tones across files.

6. Dev-time missing-provider warning
- Warn once in development when `useToast` is outside provider.

7. Event-source agnostic ingestion
- Local and remote events must flow through the same normalization/emission path.

8. Roll-result dedupe guard
- Must dedupe by stable key/id before rendering a toast.

9. External payload hardening
- Remote payload parsing must never throw; malformed values must degrade gracefully.

10. Single live-announcement channel
- Remove/reduce competing `aria-live` tray result output when toast channel is active.

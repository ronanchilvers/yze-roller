# Codebase Optimisation Plan

## Context

The codebase has strong fundamentals: 753 tests, ESLint/Prettier, CI, CSP, crypto RNG, pinned deps, zero dead code. Previous code-quality and security plans are complete.

The remaining maintainability bottleneck is **file size** — four files account for 4,448 lines and mix multiple concerns. Decomposing them improves readability, testability, and makes future changes less risky.

| File | Lines | Problem |
|---|---|---|
| `App.jsx` | 1,709 | Mixes solo rolling, multiplayer orchestration, toast bridge, GM actions, routing, and ~20 normalizers |
| `useMultiplayerSession.js` | 994 | ~257 lines of pure helpers inline before the hook |
| `DiceTray3D.jsx` | 649 | 142-line settlement loop inside useFrame callback |
| `App.css` | 1,096 | Single flat file despite section comments |

**Goal:** Reduce each file to a single clear responsibility. Target App.jsx under 400 lines, other files proportionally smaller. All existing tests must remain green after every step.

---

## Phase 1 — App.jsx Decomposition

Each step is independently shippable. Run `npq-hero run test` and `npq-hero run build` after each.

### Step 1: Extract session event normalizers to lib

Move the ~20 pure functions (lines 134–419) and the two normalizers below `DiceRollerApp` (lines 1401–1418) to `src/lib/session-event-normalize.js`. Add unit tests in `src/lib/session-event-normalize.test.js`.

- **Create:** `src/lib/session-event-normalize.js`, `src/lib/session-event-normalize.test.js`
- **Modify:** `src/App.jsx` — replace inline functions with imports
- **Reduction:** ~305 lines

### Step 2: Extract session action helpers to lib

Move `normalizeOutcomeCount`, `buildSessionActionRequest`, `getCurrentRollActionId`, `normalizeActionErrorMessage`, and `MAX_SUBMITTED_SESSION_ACTIONS` (lines 68–132) to `src/lib/session-action-helpers.js`. Add tests.

- **Create:** `src/lib/session-action-helpers.js`, `src/lib/session-action-helpers.test.js`
- **Modify:** `src/App.jsx`
- **Reduction:** ~65 lines

### Step 3: Extract clipboard utility to lib

Move `copyTextToClipboard` (async clipboard helper) to `src/lib/clipboard.js`.

- **Create:** `src/lib/clipboard.js`
- **Modify:** `src/App.jsx`
- **Reduction:** ~44 lines

### Step 4: Extract useSessionActionSubmit hook

Extract the session action submission effect (lines 711–787) and its refs/state into `src/hooks/useSessionActionSubmit.js`. This hook watches `currentRoll`/`recentResults`, builds action requests, deduplicates, and calls `submitRoll`/`submitPush`.

```
useSessionActionSubmit({ currentRoll, recentResults, submitRoll, submitPush })
  → { isActionSubmitPending, sessionActionError, suppressedSessionRollEventIdsRef }
```

- **Create:** `src/hooks/useSessionActionSubmit.js`
- **Modify:** `src/App.jsx`
- **Reduction:** ~85 lines

### Step 5: Extract useRemoteRollToasts hook

Extract `emitRollToastEvent` callback, the remote roll bridge effect, and the session event toast effect into `src/hooks/useRemoteRollToasts.js`. Encapsulates all deduplicated toast notification logic for remote roll events.

```
useRemoteRollToasts({ sessionEvents, sessionSelfTokenId, sessionSelfDisplayName, sessionId, suppressedSessionRollEventIdsRef })
  → { emitRollToastEvent }
```

The local roll toast effect stays in DiceRollerApp (depends on local `currentRoll` state).

- **Create:** `src/hooks/useRemoteRollToasts.js`
- **Modify:** `src/App.jsx`
- **Reduction:** ~110 lines

### Step 6: Extract useGmActions hook

Extract GM action runner and all GM handlers (`handleRotateJoinLink`, `handleToggleJoining`, `handleResetSceneStrain`, `handleRefreshPlayers`, `handleRevokePlayer`, `handleCopyJoinLink`) plus their state into `src/hooks/useGmActions.js`.

```
useGmActions({ gmControls })
  → { gmActionError, gmActionMessage, gmPendingAction, rotatedJoinLink, handle* }
```

- **Create:** `src/hooks/useGmActions.js`
- **Modify:** `src/App.jsx`
- **Reduction:** ~177 lines

### Step 7: Extract SessionView and MultiplayerAuthLostView components

Move `SessionView` (lines 1455–1570), `MultiplayerAuthLostView` (lines 1378–1399), and `buildConnectionSummary` (lines 1420–1453) to their own component files.

- **Create:** `src/components/SessionView.jsx`, `src/components/MultiplayerAuthLostView.jsx`
- **Modify:** `src/App.jsx`
- **Reduction:** ~170 lines

### Step 8: Extract GmControlsPanel component

Extract the GM controls panel JSX block (~130 lines of JSX) into `src/components/GmControlsPanel.jsx`. Pure presentational — receives all data via props.

- **Create:** `src/components/GmControlsPanel.jsx`
- **Modify:** `src/App.jsx`
- **Reduction:** ~130 lines

**Phase 1 result:** App.jsx drops from 1,709 → ~395 lines (DiceRollerApp ~350, App router ~45).

---

## Phase 2 — useMultiplayerSession.js Decomposition

### Step 9: Extract multiplayer normalization helpers to lib

Move the ~15 pure functions (lines 33–287) to `src/lib/multiplayer-normalize.js`. Includes `isObjectLike`, `normalizeNonNegativeInteger`, `normalizeEventList`, `normalizeRole`, `normalizeDisplayName`, `normalizePlayerSummary`, `normalizeGmPlayers`, `normalizeOutcomeCount`, `validateRollPayload`, `validatePushPayload`, `isAuthFailure`, `buildEventsPath`, `requestEventsWithTimeout`, `scaleIdleInterval`, `buildErrorBackoffIntervalMs`, `extractNextSinceId`, `buildAuthLostState`, `getGmContext`, and `INITIAL_MULTIPLAYER_SESSION_STATE`. Add tests.

- **Create:** `src/lib/multiplayer-normalize.js`, `src/lib/multiplayer-normalize.test.js`
- **Modify:** `src/hooks/useMultiplayerSession.js`
- **Reduction:** ~255 lines (hook drops to ~740)

### Step 10: Extract useEventPolling hook

Extract polling machinery (`clearPollTimer`, `stopPolling`, `runPollCycle`, `startPolling`, all polling refs) into `src/hooks/useEventPolling.js`.

```
useEventPolling({ onEventsReceived, onAuthFailure })
  → { startPolling, stopPolling, pollingStatus, pollIntervalMs, sinceIdRef, sessionTokenRef }
```

- **Create:** `src/hooks/useEventPolling.js`
- **Modify:** `src/hooks/useMultiplayerSession.js`
- **Reduction:** ~150 lines (hook drops to ~590)

**Phase 2 result:** useMultiplayerSession.js drops from 994 → ~590 lines.

---

## Phase 3 — DiceTray3D.jsx Decomposition

### Step 11: Extract useSettlementDetection hook

Extract the 142-line settlement detection logic from the `useFrame` callback into `src/hooks/useSettlementDetection.js`. Receives refs to physics bodies and pending simulation state; calls `onRollResolved` when all dice settle.

- **Create:** `src/hooks/useSettlementDetection.js`
- **Modify:** `src/components/DiceTray3D.jsx`
- **Reduction:** ~145 lines (drops to ~505)

---

## Phase 4 — CSS Split

### Step 12: Split App.css along section boundaries

Split into focused files along existing section comments. `App.css` becomes a barrel of `@import` statements.

| New file | Content |
|---|---|
| `src/tokens.css` | `:root` variables and dark-mode overrides |
| `src/layout.css` | Layout shell, skip link |
| `src/components/JoinSessionView.css` | Join route styles |
| `src/components/TopBar.css` | Top bar, strain pill, session indicators |
| `src/components/DicePoolPanel.css` | Content grid, dice pool controls, tabs, import |
| `src/components/DiceStage.css` | Dice stage styles |
| `src/responsive.css` | Responsive overrides |

- **Create:** 7 CSS files
- **Modify:** `src/App.css` → barrel of `@import`s
- **Verify:** Build passes, visual regression check via dev server

---

## Phase 5 — Minor Cleanups

### Step 13: Replace Math.random() in multiplayer backoff

Replace `Math.random()` default parameter in `buildErrorBackoffIntervalMs` with `cryptoRandom()` from `src/lib/secure-random.js`. One-line change + import.

- **Modify:** `src/lib/multiplayer-normalize.js` (after Step 9 moves it there)

### Step 14: Update architecture documentation

Update `docs/architecture.md` to reflect the new module structure. Add the new hooks, lib modules, and CSS split to the module map.

- **Modify:** `docs/architecture.md`

---

## Projected Outcomes

| File | Before | After |
|---|---|---|
| `App.jsx` | 1,709 | ~395 |
| `useMultiplayerSession.js` | 994 | ~590 |
| `DiceTray3D.jsx` | 649 | ~505 |
| `App.css` | 1,096 | ~10 (barrel) |

New files: ~14 source + ~8 test files. All existing 753 tests remain green.

## Verification

After each step:
1. `npq-hero run test` — all tests pass
2. `npq-hero run build` — no build errors
3. `npq-hero run lint` — no lint violations

After all steps:
4. `npq-hero run dev` — visual smoke test, solo roll, push, multiplayer host/join
5. Compare bundle sizes against baseline (should be unchanged or smaller)

## Critical Test Files

These integration tests import from `App.jsx` and must stay green throughout:
- `src/App.toast-integration.test.jsx`
- `src/App.join-flow.test.jsx`

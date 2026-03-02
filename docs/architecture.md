# Architecture Overview

This document describes the current module structure for the Year Zero Dice Roller after the 2026-02-27 refactor phases.

## High-Level Runtime Flows

### 1) Local roll flow (solo + session mode core)
1. `DicePoolPanel` collects dice counts/modifier and triggers roll/push actions.
2. `useRollSession` builds a `rollRequest` and exposes roll state.
3. `DiceTray3D` runs the 3D simulation and resolves outcomes.
4. `useSettlementDetection` detects when all dice settle and calls `onRollResolved`.
5. `useRollSession` updates `currentRoll`/history; `useStrainTracker` updates local strain when authoritative multiplayer strain is not active.

### 2) Multiplayer flow
1. `App` resolves mode (`host`, `join`, `session`, `auth_lost`) from route + in-memory auth.
2. `HostSessionView` and `JoinSessionView` create/join sessions and write auth via `session-auth`.
3. `useMultiplayerSession` bootstraps from `/session`, starts polling via `useEventPolling`, and exposes submit/GM actions.
4. `useSessionActionSubmit` syncs local roll/push outcomes to multiplayer events with dedupe and pending/error state.
5. `useRemoteRollToasts` emits remote roll/push toasts while suppressing self echoes.
6. `SessionView` renders multiplayer connection summary and wraps `DiceRollerApp`.

## Top-Level Composition

- `src/App.jsx`
  - Orchestrates routing/mode transitions.
  - Builds `sessionSummary`, `sessionActions`, `gmControls`, `sessionConnectionMeta`.
  - Wires presentational shells: `SessionView`, `MultiplayerAuthLostView`, `HostSessionView`, `JoinSessionView`.
- `src/main.jsx`
  - App bootstrap + toast provider wiring.

## Hooks (`src/hooks`)

- `useRollSession` — core roll/push lifecycle and history.
- `useSettlementDetection` — physics settlement detection extracted from `DiceTray3D`.
- `usePoolSelection` — local dice-count persistence and normalization.
- `useStrainTracker` — local strain state and reset/increment logic.
- `useThemePreference` — `light`/`dark`/`system` preference persistence and resolution.
- `useCharacterImport` — character JSON ingestion and selected attribute/skill state.
- `useMultiplayerSession` — snapshot bootstrap, event state, submit actions, GM actions.
- `useEventPolling` — timer/ref polling loop mechanics for `/events`.
- `useSessionActionSubmit` — local outcome -> session action sync with dedupe.
- `useRemoteRollToasts` — remote/session roll toast bridge and dedupe.
- `useToast`, `useLatestRef` — utility hooks.

## Library Modules (`src/lib`)

### Gameplay and rendering
- `dice.js`, `roll-session.js`, `strain-points.js`, `roll-modifier.js`
- `physics.js`, `face-mapping.js`, `viewport-bounds.js`, `textures.js`, `dice-visuals.js`
- `secure-random.js` (fairness-critical RNG)

### Multiplayer domain
- `api-client.js`, `app-config.js`
- `session-auth.js`, `session-snapshot.js`
- `multiplayer-normalize.js`, `multiplayer-event-reducer.js`
- `session-event-normalize.js`, `session-action-helpers.js`, `roll-toast-event.js`
- `join-session-route.js`, `clipboard.js`

### Persistence / preferences
- `pool-persistence.js`, `theme-preference.js`

## Components (`src/components`)

- `DiceTray3D.jsx` — 3D dice simulation and rendering.
- `DicePoolPanel.jsx` — dice pool controls, manual/import tabs, action row.
- `SessionView.jsx` — multiplayer session wrapper + bootstrap handoff.
- `MultiplayerAuthLostView.jsx` — auth-lost recovery shell.
- `GmControlsPanel.jsx` — GM-only controls surface.
- `HostSessionView.jsx`, `JoinSessionView.jsx` — multiplayer entry flows.
- `toast/*` — provider/container/constants for toast notifications.
- `ErrorBoundary.jsx`, `LucideIcon.jsx` — shared UI utilities.

## Styling Architecture

Global app styles are split into focused files and imported via `src/App.css`:

- `src/tokens.css` — design tokens and theme overrides.
- `src/layout.css` — application shell and structural layout.
- `src/components/JoinSessionView.css` — join-mode styles.
- `src/components/TopBar.css` — top bar, role/session indicators, strain pill.
- `src/components/DicePoolPanel.css` — panel, tabs, form controls, action row.
- `src/components/DiceStage.css` — dice stage / canvas layer styles.
- `src/responsive.css` — responsive overrides.

Toast styling remains in `src/components/toast/Toast.css`.

## Key Contracts

### `rollRequest` (local simulation)
Produced by `useRollSession`, consumed by `DiceTray3D`.
- `key`, `action`, `dice`, `rerollIds`, `startedAt`

### `onRollResolved` (simulation output)
Produced by `DiceTray3D`, consumed by `useRollSession`.
- `key`, `action`, `rolledAt`, `dice`

### Session action payloads
Built from resolved local outcomes and submitted via `useMultiplayerSession`:
- `roll`: `{ successes, banes }`
- `push`: `{ successes, banes, strain }`

### Event normalization boundary
Incoming session events are normalized through `session-event-normalize` and reduced through `multiplayer-event-reducer` before UI consumption.

## Security and Trust Boundaries

See `docs/security.md` for CSP, RNG guarantees, and client-side validation boundaries.

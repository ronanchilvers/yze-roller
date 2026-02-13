# Architecture Overview

This document describes the core architecture of the Year Zero Engine Dice Roller, including data flow, module responsibilities, and key contracts between modules.

---

## High-Level Data Flow

1. **User input (dice selection)**
   - UI input changes are handled by `usePoolSelection`.
   - Values are normalized and persisted to localStorage.

2. **Roll orchestration**
   - `useRollSession` builds the dice pool and creates `rollRequest` objects.
   - `rollRequest` is passed into `DiceTray3D` for simulation.

3. **3D simulation**
   - `DiceTray3D` runs physics (cannon-es) and resolves final face values.
   - It emits `onRollResolved` with the final dice results.

4. **Session state update**
   - `useRollSession` consumes `onRollResolved` and updates `currentRoll` / `previousRoll`.
   - Strain points are updated via `useStrainTracker`.

5. **Rendering and history**
   - `App` renders the current summary and a history of rolls.

---

## Module Responsibilities

### Lib Modules (`src/lib/`)
- `dice.js` — Pool building, rolling, pushing, normalization presets
- `secure-random.js` — Cryptographically secure RNG (`cryptoRandom`)
- `physics.js` — Physics helpers and spawn/launch behavior
- `textures.js` — Canvas-based texture generation for dice and felt
- `face-mapping.js` — Quaternion ↔ face mapping
- `viewport-bounds.js` — Camera-to-bounds calculation
- `roll-session.js` — Roll/push state transitions and validation helpers
- `strain-points.js` — Strain point normalization and bane handling
- `pool-persistence.js` — localStorage persistence with schema guards
- `dice-visuals.js` — Die color mapping

### Hooks (`src/hooks/`)
- `usePoolSelection` — Dice count state + localStorage persistence
- `useRollSession` — Roll orchestration and history
- `useStrainTracker` — Strain point state management
- `useLatestRef` — Ref synchronization utility

### Components (`src/components/`)
- `DiceTray3D` — 3D physics simulation and rendering

---

## Key Contracts

### `rollRequest` Contract
Created by `useRollSession`, consumed by `DiceTray3D`.

Shape:
- `key`: unique identifier
- `action`: `"roll"` or `"push"`
- `dice`: array of dice objects (id/type/face)
- `rerollIds`: array of dice ids to re-roll
- `startedAt`: timestamp (ms)

Validation:
- `isValidRollRequest` in `roll-session.js` (runtime validation at boundary)

### `onRollResolved` Contract
Emitted by `DiceTray3D`, consumed by `useRollSession`.

Shape:
- `key`: matches the originating request
- `action`: `"roll"` or `"push"`
- `rolledAt`: timestamp (ms)
- `dice`: array of resolved dice (id/type/face/wasPushed)

Validation:
- `isValidResolution` in `roll-session.js`

---

## Strain Flow

1. `useStrainTracker` maintains `normalizedStrainPoints`.
2. `buildCountsWithStrain` merges strain points into the dice pool.
3. `useRollSession` updates strain based on new banes via `calculateBaneIncrease`.

---

## Year Zero Engine Dice Mechanics (Quick Primer)

- **Dice types:** Attribute, Skill, Strain
- **Successes:** face value `6`
- **Banes:** face value `1`
- **Push:** Re-roll non-1, non-6 results (faces 2–5)
- **Strain:** banes on strain dice are tracked and can affect future rolls

---

## Security Reference

Threat model and trust boundaries are documented in:
- `docs/security.md`

This includes:
- RNG guarantees
- localStorage validation
- component boundary validation
- CSP details

---

## Notes

- `DiceTray3D` resolves outcomes via physics simulation; `dice.js` roll helpers are used mainly for headless testing and integration tests.
- The visual layer is intentionally decoupled from state orchestration; data flows through explicit contracts.
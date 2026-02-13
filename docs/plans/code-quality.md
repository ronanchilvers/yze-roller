# Code Quality Improvement Plan

Targeted tasks to reduce complexity, eliminate duplication, and improve maintainability.

---

## 1. Decompose `DiceTray3D.jsx` (~770 lines)

The single largest source of complexity. Split into focused modules:

- [ ] Extract texture generation (`createFeltTexture`, `createFaceTexture`, `createMaterialSet`, `disposeMaterialSet`) into `src/lib/textures.js`
- [ ] Extract physics helpers (`createStaticBox`, `freezeBodyInPlace`, `clampBodyInside`, `spawnBodyInViewport`, `launchRollingBody`, `nudgeEdgeLeaningDie`) into `src/lib/physics.js`
- [ ] Extract face/quaternion logic (`topFaceFromQuaternion`, `quaternionForFaceValue`, `FACE_NORMALS`, `FACE_ORDER_BY_SIDE`) into `src/lib/face-mapping.js`
- [ ] Extract bounds calculation (`calculateBounds`) into `src/lib/viewport-bounds.js`
- [ ] Extract the settlement/resolve logic (the `useFrame` callback body, ~100 lines) into a standalone function that can be unit-tested without a canvas

**Goal:** `DiceTray3D.jsx` should contain only component wiring and JSX — ideally under 200 lines.

---

## 2. Extract a `getDieId` helper

The pattern `String(die?.id ?? \`die-${index + 1}\`)` appears 6+ times in `DiceTray3D.jsx` and is also replicated in `dice-visuals.js` and `dice.js` (`normalizeDie`).

- [ ] Add `export const getDieId = (die, index) => String(die?.id ?? \`die-${index + 1}\`)` to `src/lib/dice.js`
- [ ] Replace all inline occurrences in `DiceTray3D.jsx` and `dice-visuals.js`

---

## 3. Simplify App.jsx state management

`App.jsx` (~280 lines) mixes roll orchestration, strain tracking, history management, and UI rendering.

- [ ] Extract roll orchestration into a custom hook: `useRollSession` — owns `currentRoll`, `previousRoll`, `rollRequest`, `recentResults`, and exposes `onRoll`, `onPush`, `onRollResolved`, `onClearDice`
- [ ] Extract strain tracking into a custom hook: `useStrainTracker` — owns `strainPoints` and exposes `normalizedStrainPoints`, `onResetStrain`, and `applyBaneIncrement`
- [ ] Extract pool persistence into a custom hook: `usePoolSelection` — owns `attributeDice`, `skillDice` and auto-saves to localStorage
- [ ] Collapse the three ref-sync `useEffect` calls (`rollRequestRef`, `currentRollRef`, `previousRollRef`) into a shared `useLatestRef(value)` hook

**Goal:** `App.jsx` should be primarily JSX with hooks, under 120 lines.

---

## 4. Reduce `onRollResolved` complexity

The `onRollResolved` callback is ~50 lines with nested branching for push vs roll, bane calculation, and history updates.

- [ ] Extract bane-increment calculation into a pure function in `strain-points.js`: `calculateBaneIncrease(previousRoll, nextRoll, isFirstPush) → number`
- [ ] Extract history-entry creation into a pure helper
- [ ] Simplify the callback to compose these helpers linearly

---

## 5. Eliminate dead exports

- [ ] `selectAnimatedDiceIds` in `dice-visuals.js` is exported but never imported outside its own test file — remove or mark with a `// TODO: integrate` comment if planned for future use
- [ ] Audit all other exports for unused code (`rollPool`, `pushPool` appear unused in app code — confirm and document intent)

---

## 6. Deduplicate `createSequenceRng` across test files

The same RNG test helper is defined identically in `dice.test.js` and `strain-points.test.js`.

- [ ] Create `src/lib/test-helpers.js` with shared test utilities
- [ ] Import from both test files

---

## 7. Consolidate repeated normalization option objects

`normalizeDiceCount` is called with identical `{ min: 1, max: MAX_DICE, fallback: 1 }` (attribute) and `{ min: 0, max: MAX_DICE, fallback: 0 }` (skill) option sets in `pool-persistence.js`, `dice.js`, and `App.jsx`.

- [ ] Define named option presets in `dice.js`: `ATTRIBUTE_DICE_OPTS`, `SKILL_DICE_OPTS`, `STRAIN_DICE_OPTS`
- [ ] Replace all inline option objects with the presets

---

## 8. Tame magic numbers in physics code

`launchRollingBody`, `spawnBodyInViewport`, and `nudgeEdgeLeaningDie` contain unexplained numeric literals (`0.32`, `1.8`, `3.2`, `9.2`, `13.8`, `6.4`, `26`, etc.).

- [ ] Define named constants for spawn heights, velocity ranges, angular velocity ranges, and push-reroll offsets
- [ ] Group them in the extracted `physics.js` module with brief comments explaining each

---

## 9. Add unit tests for extracted modules

Once decomposed, each new module should be testable without a browser/canvas:

- [ ] `face-mapping.js` — test `topFaceFromQuaternion` with known quaternions
- [ ] `physics.js` — test `clampBodyInside` boundary logic with mock body objects
- [ ] `viewport-bounds.js` — test `calculateBounds` with mock camera configs
- [ ] `textures.js` — test that factory functions return objects with expected shape (skip pixel-level validation)

---

## 10. Improve CSS organisation

- [ ] Extract component-scoped styles: `strain-pill`, `tray-panel`, `controls-panel`, and `history-dropdown` each deserve their own CSS section or file if CSS modules are adopted
- [ ] Remove the `!important` on `.tray-stage canvas` — investigate why the Three.js canvas needs forced sizing and fix upstream (likely a missing container style)
- [ ] Audit for unused CSS selectors

---

## Summary

| Area | Current | Target |
|---|---|---|
| `DiceTray3D.jsx` | ~770 lines, 0 tests | <200 lines, extracted modules tested |
| `App.jsx` | ~280 lines, mixed concerns | <120 lines, 3 custom hooks |
| Duplicated patterns | 6+ inline `getDieId`, 2× test helper, 3× option objects | Single source of truth each |
| Dead code | ≥1 unused export | Zero or explicitly documented |
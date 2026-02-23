# Dice Modifier Implementation Plan

## Summary
Add a roll-time dice modifier (`-3` to `+3`, default `0`) that affects the final rolled pool for both Manual and Import Character rolls without mutating visible Attribute/Skill counts in the UI. Positive modifiers add new purple modifier dice; negative modifiers remove dice from Skill first, then Attribute, while never removing Strain dice and never dropping below 1 Attribute die.

## Relevant Current Context
- Roll requests are created in `src/hooks/useRollSession.js` via `buildCountsWithStrain(...)` + `buildDicePool(...)`.
- Manual and import flows both feed roll counts through `onRollWithCounts` in `src/components/DicePoolPanel.jsx`, coordinated by `handleRollWithCounts` in `src/App.jsx`.
- `src/App.jsx` already supports roll-only overrides (`overrideCounts`) so temporary roll values do not change persistent displayed values.
- Dice types and pool construction are centralized in `src/lib/dice.js`.
- Die colors are mapped in `src/lib/dice-visuals.js`.
- 3D materials are created per die type in `src/components/DiceTray3D.jsx`.
- Dice Pool actions (Push/Clear) live in `DicePoolPanel` footer (`.panel-action-row`), where the modifier slider should be inserted above.

## Functional Requirements Mapping
1. Add modifier die type and render it in purple.
2. Add modifier slider above Push/Clear controls.
3. Slider range: `-3` to `+3`, default `0`.
4. Apply modifier for rolls triggered from Manual and Import tabs.
5. Positive modifier: add that many modifier dice.
6. Negative modifier: remove Skill first, then Attribute, never Strain.
7. Enforce minimum pool floor: at least 1 Attribute die always remains.
8. Do not change displayed Attribute/Skill values when modifier is applied.

## Proposed Design

### 1) Modifier Computation as Pure Helper
Create a dedicated helper module (for example `src/lib/roll-modifier.js`) with:
- `normalizeRollModifier(value)` clamped to `[-3, 3]`.
- `applyRollModifierToCounts({ attributeDice, skillDice, strainDice }, modifier)` returning:
  - adjusted `attributeDice` / `skillDice`,
  - untouched `strainDice`,
  - `modifierDice` (only positive values).

Algorithm for negative modifier:
1. `remaining = abs(modifier)`.
2. Remove from `skillDice` up to `remaining`.
3. Remove from `attributeDice` up to `attributeDice - 1`.
4. Stop when `remaining` is 0 or no removable dice remain.

This isolates all edge-case logic and makes behavior easy to test.

### 2) Extend Dice Domain for Modifier Dice
In `src/lib/dice.js`:
- Add `DICE_TYPE.MODIFIER`.
- Allow `normalizeDieType` to preserve `modifier`.
- Extend `buildDicePool` to append `modifierDice` entries with IDs like `modifier-1`, `modifier-2`, etc.
- Keep outcome rules unchanged (modifier dice should count successes/banes like normal non-strain dice; only strain type controls `hasStrain`).

### 3) Apply Modifier at Roll-Time Only
In `src/hooks/useRollSession.js`:
- Accept `rollModifier` as input.
- In `onRoll`, compute base counts (`attribute`, `skill`, `strain`) as today.
- Apply modifier helper before `buildDicePool`.

Why here:
- This is the single roll-request creation point for both Manual and Import paths.
- It guarantees modifier affects only rolled dice, not stored/displayed pool values.

### 4) App State + Wiring
In `src/App.jsx`:
- Add local state: `rollModifier` initialized to `0`.
- Pass `rollModifier` to `useRollSession`.
- Pass `rollModifier` and setter callback to `DicePoolPanel`.

No persistence is required for this change unless explicitly requested later.

### 5) UI Slider in DicePoolPanel
In `src/components/DicePoolPanel.jsx`:
- Add slider UI just above `.panel-action-row`:
  - `<input type="range" min={-3} max={3} step={1}>`
  - label text: `Dice Modifier`
  - visible numeric value (show sign for positives, e.g. `+2`).
- Add props:
  - `rollModifier` (number, required)
  - `onRollModifierChange` (function, required)
- Ensure this control is shared across tabs and does not alter manual field values.

In `src/App.css`:
- Add styles for modifier control block and slider track/thumb.
- Keep responsive behavior aligned with existing panel layout.

### 6) Purple Die Rendering
Update visuals and 3D materials:
- `src/lib/dice-visuals.js`: map modifier die to purple hex.
- `src/components/DiceTray3D.jsx`: create/dispose material set for `DICE_TYPE.MODIFIER`.

## File-Level Change List
- `src/lib/roll-modifier.js` (new): modifier normalization and count-adjustment helper.
- `src/lib/roll-modifier.test.js` (new): unit tests for modifier algorithm.
- `src/lib/dice.js`: add modifier die type + pool building support.
- `src/lib/dice.test.js`: extend pool/type behavior coverage for modifier dice.
- `src/lib/dice-visuals.js`: add modifier purple mapping.
- `src/lib/dice-visuals.test.js`: assert modifier color.
- `src/hooks/useRollSession.js`: apply modifier during roll request creation.
- `src/App.jsx`: hold modifier state and wire to panel + hook.
- `src/components/DicePoolPanel.jsx`: render slider + new props.
- `src/components/DicePoolPanel.test.jsx`: slider rendering, range/default, callback behavior.
- `src/App.css`: modifier control styling.

## Test Plan
1. Unit tests for modifier helper:
   - clamps to `[-3, 3]`.
   - `+N` adds `modifierDice = N`.
   - negative removes skill first.
   - negative removes attribute second.
   - never removes strain dice.
   - never drops below 1 attribute die.
2. Dice library tests:
   - `buildDicePool` includes modifier dice with correct type/IDs.
   - normalization keeps modifier type valid.
3. Visual mapping tests:
   - modifier die resolves to purple color.
4. Panel tests:
   - slider exists with min/max/default.
   - changing slider calls handler with normalized integer.
   - push/clear row still renders and functions.
5. Integration check (targeted):
   - verify roll request from manual/import path includes adjusted dice counts while displayed manual inputs remain unchanged.

## Risks and Mitigations
- Risk: applying modifier in UI state path may mutate displayed counts.
  - Mitigation: apply only inside roll-session request creation.
- Risk: new die type not included in material map causes fallback color/visual mismatch.
  - Mitigation: explicit modifier material set + color test.
- Risk: negative modifier logic accidentally reduces below minimum attribute floor.
  - Mitigation: pure helper with explicit floor tests.

## Definition of Done
- Slider appears above Push/Clear with range `-3..+3`, default `0`.
- Rolls from Manual and Import both apply modifier correctly.
- Positive modifier adds purple modifier dice.
- Negative modifier removes dice in required priority and constraints.
- At least 1 attribute die always remains.
- Displayed Attribute/Skill counts remain unchanged by modifier effects.
- Tests updated/added and passing.

# Security Improvement Plan

Targeted tasks to harden the application against common web vulnerabilities, improve randomness guarantees, and reduce attack surface.

> **Updated** after completion of the Code Quality plan. File paths, module references, and scope reflect the decomposed codebase structure.

---

## Current module layout (for reference)

| Module | Responsibility |
|---|---|
| `src/lib/dice.js` | Pool building, rolling, pushing, normalization presets |
| `src/lib/physics.js` | Physics body helpers, `randomBetween()` |
| `src/lib/textures.js` | Canvas-based texture generation (`createFeltTexture`, `createFaceTexture`, `createMaterialSet`, `disposeMaterialSet`) |
| `src/lib/face-mapping.js` | Quaternion ↔ face-value mapping |
| `src/lib/viewport-bounds.js` | Camera-to-bounds calculation |
| `src/lib/roll-session.js` | Roll/push state transitions |
| `src/lib/strain-points.js` | Strain point normalization and bane calculation |
| `src/lib/pool-persistence.js` | localStorage read/write with `ATTRIBUTE_DICE_OPTS` / `SKILL_DICE_OPTS` presets |
| `src/lib/dice-visuals.js` | Die colour mapping |
| `src/hooks/useRollSession.js` | Roll orchestration hook (creates `rollRequest`, handles `onRollResolved`) |
| `src/hooks/usePoolSelection.js` | Pool selection with localStorage persistence |
| `src/hooks/useStrainTracker.js` | Strain point state |
| `src/hooks/useLatestRef.js` | Ref-sync utility |
| `src/components/DiceTray3D.jsx` | 3D physics simulation and rendering (~495 lines) |

---

## 1. Replace `Math.random()` with `crypto.getRandomValues()`

`Math.random()` is not cryptographically secure. For a dice roller — where fairness is the core promise — this is a meaningful weakness.

**Dice-outcome randomness** (high priority):

- [ ] Create `src/lib/secure-random.js` exporting a `cryptoRandom()` function that returns a float in `[0, 1)` using `crypto.getRandomValues(Uint32Array)`
- [ ] Change the default `randomSource` parameter from `Math.random` to `cryptoRandom` in `rollD6`, `rollDice`, `pushDice`, `rollPool`, and `pushPool` (all in `src/lib/dice.js`)
- [ ] Keep the injectable `randomSource` parameter for deterministic testing — only change the default
- [ ] Update `src/lib/test-helpers.js` JSDoc to note that `createSequenceRng` overrides the secure default

**Cosmetic randomness** (low priority — physics jitter and texture grain):

- [ ] Update `randomBetween()` in `src/lib/physics.js` to accept an optional `randomSource` parameter (default: `cryptoRandom`)
- [ ] Update `createFeltTexture()` in `src/lib/textures.js` — the `Math.random()` call on line 32 generates visual noise only; replace for consistency but note this is non-security-critical
- [ ] Document in `secure-random.js` which call sites are fairness-critical vs cosmetic

---

## 2. Add a Content-Security-Policy

`index.html` has no CSP. A strict policy prevents XSS, inline script injection, and data exfiltration.

- [ ] Add a `<meta http-equiv="Content-Security-Policy">` tag to `index.html` with at minimum:
  - `default-src 'self'`
  - `script-src 'self'` (Vite dev mode may need `'unsafe-inline'` — gate this behind a dev-only HTML template or Vite plugin)
  - `style-src 'self' 'unsafe-inline'` (required for react-three/fiber inline canvas styles — see `App.css` `.tray-stage canvas` comment)
  - `img-src 'self' blob: data:` (canvas textures in `textures.js` use blob/data URIs)
  - `connect-src 'self'`
  - `object-src 'none'`
  - `base-uri 'self'`
- [ ] Verify the policy doesn't break the Three.js canvas, texture generation, or Vite HMR in dev
- [ ] Document any necessary policy exceptions with inline comments

---

## 3. Guard against localStorage abuse

`loadPoolSelection` in `pool-persistence.js` parses JSON from localStorage without checking size. A malicious or corrupted entry could trigger excessive memory allocation.

- [ ] Add a size guard in `loadPoolSelection`: reject raw values exceeding a reasonable threshold (e.g., 1 KB) before calling `JSON.parse`
- [ ] Add a schema check after parsing: verify the parsed object has only the expected keys (`attributeDice`, `skillDice`) and no unexpected nested structures
- [ ] Add a test in `pool-persistence.test.js` for oversized localStorage values to confirm graceful fallback

**Already addressed by the code quality refactoring:**
- ✅ `sanitizeSelection()` now uses `ATTRIBUTE_DICE_OPTS` and `SKILL_DICE_OPTS` presets with spread, giving tighter validation
- ✅ `sanitizePoolCounts()` normalizes every field through `normalizeDiceCount()` with bounded presets
- ✅ `savePoolSelection()` already writes only `attributeDice` and `skillDice` (allowlisted fields)

---

## 4. Sanitise all data read from persistence

The validation chain is now tighter thanks to the named presets, but one gap remains: `JSON.parse` output passes through `sanitizePoolCounts` which normalizes known fields but doesn't strip unknown ones.

- [ ] Add an explicit allowlist step in `loadPoolSelection`: after parsing, pick only `attributeDice` and `skillDice` — discard everything else before passing to normalization
- [ ] Add a round-trip test in `pool-persistence.test.js` that confirms unknown/injected fields are stripped after save → load

**Already addressed:**
- ✅ `savePoolSelection` writes only the two allowlisted fields
- ✅ `sanitizePoolCounts` now uses frozen option presets (`ATTRIBUTE_DICE_OPTS`, `SKILL_DICE_OPTS`, `STRAIN_DICE_OPTS`) rather than inline objects

---

## 5. Prevent DOM element leaks from texture generation

`createFeltTexture` and `createFaceTexture` in `src/lib/textures.js` call `document.createElement("canvas")` outside React's lifecycle. These detached canvas elements and their 2D contexts can leak if not handled carefully.

- [ ] After creating the `THREE.CanvasTexture`, explicitly null out references to the source canvas and context so the GC can reclaim them
- [ ] Add a test (or manual verification) that `disposeMaterialSet` calls `.map.dispose()` for every material — this function already exists in `textures.js` and is invoked in `DiceTray3D.jsx`'s cleanup effect
- [ ] Consider reusing a single `OffscreenCanvas` for all face textures instead of creating 18 separate elements (6 faces × 3 die types) — measure if this materially reduces peak memory

---

## 6. Add `rel="noopener"` policy and referrer control

- [ ] Add `<meta name="referrer" content="no-referrer">` to `index.html` — the app has no external links today, but this is a defensive default
- [ ] If external links are ever added, ensure they use `rel="noopener noreferrer"`

---

## 7. Pin dependency versions

`package.json` uses caret ranges (`^`) for all dependencies. A compromised minor/patch release of `three`, `cannon-es`, or `react` would be pulled in automatically.

- [ ] Pin exact versions for production dependencies: `react`, `react-dom`, `three`, `cannon-es`, `@react-three/fiber`
- [ ] Keep caret ranges for dev dependencies (`vite`, `@vitejs/plugin-react`) where flexibility is less risky
- [ ] Consider adding `npm audit` or `npq-hero audit` as a pre-build step
- [ ] Verify pinned versions match current `node_modules` to avoid surprise changes

---

## 8. Validate `rollRequest` shape at the component boundary

`DiceTray3D` receives `rollRequest` as a prop and trusts its shape. A malformed object could cause silent failures or unexpected physics behaviour.

- [ ] Add a lightweight validation function (`isValidRollRequest`) in `src/lib/roll-session.js` (co-located with the session logic that creates these objects) that checks:
  - `key` is defined
  - `dice` is an array
  - `action` is `"roll"` or `"push"`
  - `rerollIds` is an array of strings
- [ ] Call it at the top of the `useEffect` in `DiceTray3D.jsx` that processes roll requests (around line 160) — return early with a `console.warn` if invalid
- [ ] Add equivalent validation in `onRollResolved` in `src/hooks/useRollSession.js` for the resolution payload (the `resolution` parameter around line 146)
- [ ] Add tests for `isValidRollRequest` in `roll-session.test.js`

**Note:** `useRollSession.js` is the only code path that creates `rollRequest` objects, so validation at the consumer boundary (`DiceTray3D`) catches any future drift.

---

## 9. Avoid prototype pollution in normalisation helpers

The pattern `const source = value && typeof value === "object" ? value : {}` is used in:
- `sanitizePoolCounts` and `normalizeDie` (`dice.js`)
- `normalizeSession` and `createRollSnapshot` (`roll-session.js`)
- `incrementStrainPointsByBanes` and `buildCountsWithStrain` (`strain-points.js`)
- `sanitizeSelection` (`pool-persistence.js`)

This is safe against most attacks since only explicit property access is used (no `for...in` or `Object.keys` iteration over untrusted objects).

- [ ] Verify no `for...in`, `Object.keys`, `Object.entries`, or spread of untrusted objects exists across the above modules — document the finding
- [ ] Add a test in `dice.test.js` that passes an object with `__proto__` and `constructor` pollution attempts to `sanitizePoolCounts` and confirms they are ignored
- [ ] Add a similar test in `pool-persistence.test.js` for `loadPoolSelection`

---

## 10. Audit and document the threat model

- [ ] Create a `docs/security.md` document (separate from this plan) that describes:
  - What data is persisted (localStorage only, no server, key: `yze:dice-pool-selection:v1`)
  - What randomness guarantee the app provides (and which call sites are cosmetic vs fairness-critical)
  - What inputs are user-controlled (dice counts via `usePoolSelection`, roll/push actions via `useRollSession`)
  - What third-party code runs (Three.js, cannon-es, React, @react-three/fiber)
  - Module trust boundaries (which modules handle untrusted input)
- [ ] Use this as a living reference for future security decisions

---

## Summary

| Risk | Severity | Current State | Remediation |
|---|---|---|---|
| Weak RNG for dice | Medium | `Math.random()` default in `dice.js` | `crypto.getRandomValues()` via `secure-random.js` |
| No CSP | Medium | None | Strict `<meta>` policy |
| localStorage injection | Low | Size unchecked; shape validated via presets | Size guard + explicit allowlist |
| DOM element leaks | Low | Canvas elements not nulled after texture creation in `textures.js` | Explicit cleanup, possible `OffscreenCanvas` reuse |
| Unpinned dependencies | Medium | All `^` ranges in `package.json` | Pin production deps |
| No input validation at component boundary | Low | Trusted prop shapes in `DiceTray3D` | `isValidRollRequest` validator in `roll-session.js` |
| Prototype pollution | Very Low | Property-access-only pattern (safe) | Verify + regression tests |
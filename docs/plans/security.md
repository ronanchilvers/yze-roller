# Security Improvement Plan

Targeted tasks to harden the application against common web vulnerabilities, improve randomness guarantees, and reduce attack surface.

---

## 1. Replace `Math.random()` with `crypto.getRandomValues()`

`Math.random()` is not cryptographically secure. For a dice roller — where fairness is the core promise — this is a meaningful weakness.

- [ ] Create a `src/lib/secure-random.js` module exporting a `cryptoRandom()` function that returns a float in `[0, 1)` using `crypto.getRandomValues(Uint32Array)`
- [ ] Replace the default `Math.random` parameter in `rollD6`, `rollDice`, `pushDice`, `rollPool`, and `pushPool`
- [ ] Update `DiceTray3D.jsx`'s `randomBetween` helper to use the secure source (physics jitter is cosmetic, but consistency is preferable)
- [ ] Keep the injectable `randomSource` parameter for deterministic testing — only change the default

---

## 2. Add a Content-Security-Policy

`index.html` has no CSP. A strict policy prevents XSS, inline script injection, and data exfiltration.

- [ ] Add a `<meta http-equiv="Content-Security-Policy">` tag to `index.html` with at minimum:
  - `default-src 'self'`
  - `script-src 'self'` (Vite dev mode may need `'unsafe-inline'` — gate this behind a dev-only HTML template or Vite plugin)
  - `style-src 'self' 'unsafe-inline'` (required for Three.js inline canvas styles)
  - `img-src 'self' blob: data:` (canvas textures use blob/data URIs)
  - `connect-src 'self'`
  - `object-src 'none'`
  - `base-uri 'self'`
- [ ] Verify the policy doesn't break the Three.js canvas, texture generation, or Vite HMR in dev
- [ ] Document any necessary policy exceptions with inline comments

---

## 3. Guard against localStorage abuse

`loadPoolSelection` parses JSON from localStorage without checking size. A malicious or corrupted entry could trigger excessive memory allocation.

- [ ] Add a size guard in `loadPoolSelection`: reject raw values exceeding a reasonable threshold (e.g., 1 KB) before calling `JSON.parse`
- [ ] Add a schema check after parsing: verify the parsed object has only the expected keys (`attributeDice`, `skillDice`) and no unexpected nested structures
- [ ] Add a test for oversized localStorage values to confirm graceful fallback

---

## 4. Sanitise all data read from persistence

While the current `sanitizePoolCounts` and `normalizeDiceCount` functions are solid, the chain has a gap: `JSON.parse` output is passed through `sanitizePoolCounts` which only validates known fields but doesn't strip unknown ones.

- [ ] Add an explicit allowlist step: after parsing, pick only `attributeDice` and `skillDice` — discard everything else before passing to normalization
- [ ] Ensure `savePoolSelection` writes only the allowlisted fields (it currently does — add a test that confirms unknown fields are stripped on round-trip)

---

## 5. Prevent DOM element leaks from texture generation

`createFeltTexture` and `createFaceTexture` call `document.createElement("canvas")` outside React's lifecycle. These detached canvas elements and their 2D contexts can leak if not handled carefully.

- [ ] After creating the `THREE.CanvasTexture`, explicitly null out references to the canvas and context so the GC can reclaim them
- [ ] Confirm `disposeMaterialSet` disposes all associated textures — add a test that verifies `.map.dispose()` is called for every material
- [ ] Consider reusing a single offscreen canvas for all face textures instead of creating 18 separate elements (6 faces × 3 die types)

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

---

## 8. Validate `rollRequest` shape at the boundary

`DiceTray3D` receives `rollRequest` as a prop and trusts its shape. A malformed object could cause silent failures or unexpected physics behaviour.

- [ ] Add a lightweight validation function (`isValidRollRequest`) that checks: `key` is defined, `dice` is an array, `action` is `"roll"` or `"push"`, `rerollIds` is an array of strings
- [ ] Call it at the top of the `useEffect` that processes roll requests — return early with a warning if invalid
- [ ] Add equivalent validation in `onRollResolved` in `App.jsx` for the resolution payload

---

## 9. Avoid prototype pollution in normalisation helpers

The pattern `const source = value && typeof value === "object" ? value : {}` is used throughout. This is safe against most attacks, but:

- [ ] Switch to `Object.create(null)` for the fallback empty object, or use explicit property access only (already done — verify no `for...in` or spread of untrusted objects exists)
- [ ] Add a test that passes an object with `__proto__` or `constructor` pollution attempts and confirms they are ignored

---

## 10. Audit and document the threat model

- [ ] Create a `docs/security.md` document that describes:
  - What data is persisted (localStorage only, no server)
  - What randomness guarantee the app provides
  - What inputs are user-controlled (dice counts, roll/push actions)
  - What third-party code runs (Three.js, cannon-es, React)
- [ ] Use this as a living reference for future security decisions

---

## Summary

| Risk | Severity | Current State | Remediation |
|---|---|---|---|
| Weak RNG for dice | Medium | `Math.random()` default | `crypto.getRandomValues()` |
| No CSP | Medium | None | Strict `<meta>` policy |
| localStorage injection | Low | Size unchecked, shape partially validated | Size guard + allowlist |
| DOM element leaks | Low | Canvas elements not nulled | Explicit cleanup |
| Unpinned dependencies | Medium | All `^` ranges | Pin production deps |
| No input validation at component boundary | Low | Trusted prop shapes | Lightweight validators |
# Security Documentation

## Overview

This document describes the security model, threat landscape, and defensive measures implemented in the Year Zero Dice Roller application. It serves as a living reference for security decisions and future audits.

**Last Updated:** Security hardening completed (Tasks 1-10 from security improvement plan)

---

## Architecture

### Deployment Model
- **Client-side only:** No backend server, no database, no user accounts
- **Hosting:** Static files served via standard web server (Vite dev or production build)
- **Data storage:** Browser localStorage only (single key: `yze:dice-pool-selection:v1`)
- **Third-party APIs:** None

### Trust Boundaries

| Boundary | Description | Validation |
|---|---|---|
| **User Input → Pool Selection** | Dice count selection via UI | `sanitizePoolCounts()`, `normalizeDiceCount()` with bounded presets |
| **localStorage → Application** | Pool selection persistence | Size guard (1 KB limit), explicit allowlist, schema validation |
| **useRollSession → DiceTray3D** | Roll/push request objects | `isValidRollRequest()` at component boundary |
| **DiceTray3D → useRollSession** | Physics resolution payloads | `isValidResolution()` at component boundary |
| **User → Browser Storage** | Direct localStorage manipulation (devtools) | Same guards as normal read path |

---

## Data Flow

### Persisted Data
**Storage Location:** `localStorage` only  
**Key:** `yze:dice-pool-selection:v1`  
**Schema:**
```json
{
  "attributeDice": number,  // 1-20
  "skillDice": number       // 0-20
}
```

**Security Controls:**
- Maximum size: 1 KB (enforced before JSON.parse)
- Explicit allowlist: Only `attributeDice` and `skillDice` are read
- Normalization: All values passed through `normalizeDiceCount()` with min/max bounds
- No nested objects or prototype chain manipulation

**Note:** Strain points are session-only state; they are NOT persisted between page loads.

### In-Memory State
- **Roll history:** Last 10 roll summaries (outcomes only, no PII)
- **Current/previous roll:** Dice pool state and outcomes
- **Strain points:** Accumulated bane count (resets on page reload)
- **Physics simulation:** Temporary 3D body state (cleared on unmount)

---

## Randomness Guarantees

### Cryptographically Secure RNG

**Implementation:** `crypto.getRandomValues()` via `cryptoRandom()` in `src/lib/secure-random.js`

**Fairness-Critical Call Sites:**
- `rollD6()` — determines die face values (1-6)
- `rollDice()` — batch roll operations
- `pushDice()` — push reroll operations
- `rollPool()` and `pushPool()` — high-level roll APIs

**Cosmetic Randomness (also uses cryptoRandom for defense-in-depth):**
- `randomBetween()` in `physics.js` — spawn positions, velocities, angular momentum
- `createFeltTexture()` in `textures.js` — visual noise in felt texture grain

**Why This Matters:**  
Dice fairness is the core promise of this application. Using `Math.random()` would expose the RNG to:
- Predictable seed values in some browser implementations
- Potential timing attacks if the PRNG state leaks
- Exploitation via browser extensions or devtools manipulation

By using `crypto.getRandomValues()`, we provide a cryptographic guarantee that dice outcomes cannot be predicted or manipulated through RNG weaknesses.

**Testing Override:**  
Tests use `createSequenceRng()` from `test-helpers.js` to inject deterministic values. This overrides the secure default via the `randomSource` parameter but does not weaken production code.

---

## Attack Surface Analysis

### XSS (Cross-Site Scripting)
**Risk:** Medium  
**Mitigations:**
- Strict Content Security Policy (CSP) in `index.html`:
  - `default-src 'self'` — only same-origin resources
  - `script-src 'self'` — no inline scripts
  - `style-src 'self' 'unsafe-inline'` — required for Three.js canvas styles
  - `img-src 'self' blob: data:` — canvas-generated textures only
  - `object-src 'none'` — disable Flash, Java, etc.
  - `frame-ancestors 'none'` — prevent embedding in iframes
- React's built-in XSS protection (auto-escapes interpolated values)
- No `dangerouslySetInnerHTML` usage
- No dynamic script loading or `eval()`

**Residual Risk:** `'unsafe-inline'` for styles is required by react-three/fiber. This is a controlled risk since we do not allow user-provided CSS.

---

### Prototype Pollution
**Risk:** Very Low  
**Mitigations:**
- All normalization helpers use explicit property access (no `for...in`, `Object.keys`, `Object.entries`)
- localStorage loader applies explicit allowlist before normalization
- Test coverage for `__proto__` and `constructor` pollution attempts

**Verified Safe Patterns:**
```javascript
const source = value && typeof value === "object" ? value : {};
return {
  attributeDice: normalizeDiceCount(source.attributeDice, ATTRIBUTE_DICE_OPTS),
  // Only reads specific properties, never iterates
};
```

**Affected Modules:**
- `sanitizePoolCounts()` and `normalizeDie()` in `dice.js`
- `normalizeSession()` and `createRollSnapshot()` in `roll-session.js`
- `incrementStrainPointsByBanes()` and `buildCountsWithStrain()` in `strain-points.js`
- `sanitizeSelection()` in `pool-persistence.js`

---

### localStorage Injection
**Risk:** Low  
**Mitigations:**
- Size guard: Reject values exceeding 1 KB before `JSON.parse()`
- Explicit allowlist: Only `attributeDice` and `skillDice` are extracted from parsed JSON
- Schema validation: All values normalized through `normalizeDiceCount()` with min/max bounds
- Fallback to safe defaults on any parse/validation failure

**Threat Model:**  
Malicious or corrupted localStorage entries could attempt:
1. **DoS via large payloads** → Blocked by 1 KB size limit
2. **Code injection via nested objects** → Blocked by allowlist
3. **Type confusion** → Blocked by `normalizeDiceCount()` coercion
4. **Prototype pollution** → Blocked by property-access-only pattern

---

### Memory Leaks (DOM Element Retention)
**Risk:** Low  
**Mitigations:**
- Canvas elements from `createFeltTexture()` and `createFaceTexture()` are nulled after texture creation
- `disposeMaterialSet()` is called in `DiceTray3D`'s cleanup effect to release all textures and materials
- Three.js objects are explicitly disposed via `.dispose()` on unmount

**Potential Optimization:**  
Consider reusing a single `OffscreenCanvas` for all face textures instead of creating 18 separate canvas elements (6 faces × 3 die types). This would reduce peak memory usage but requires measuring the actual impact.

---

### Dependency Vulnerabilities
**Risk:** Medium  
**Mitigations:**
- **Production dependencies pinned to exact versions** (no caret ranges):
  - `react`, `react-dom`, `three`, `cannon-es`, `@react-three/fiber`
- **Dev dependencies retain caret ranges** for tooling flexibility:
  - `vite`, `@vitejs/plugin-react`
- **Audit process:** Run `npm audit` regularly to check for known vulnerabilities

**Rationale:**  
A compromised minor/patch release of a production dependency would be pulled automatically with caret ranges. Exact pinning prevents silent upgrades but requires manual review of security patches.

**Current Pinned Versions (as of security hardening):**
- `react@18.3.1`, `react-dom@18.3.1`
- `three@0.182.0`
- `cannon-es@0.20.0`
- `@react-three/fiber@8.17.10`

---

### Malformed Props (Component Boundaries)
**Risk:** Low  
**Mitigations:**
- `isValidRollRequest()` validates `rollRequest` prop in `DiceTray3D` (line ~224)
- `isValidResolution()` validates `resolution` payload in `useRollSession.onRollResolved`
- Early return with `console.warn` on validation failure (non-throwing)

**Validated Fields:**
- `rollRequest`: `key`, `action`, `dice[]`, `rerollIds[]`
- `resolution`: `key`, `action`, `dice[]`

**Threat Model:**  
Future refactoring or external components could pass malformed objects. Validation at the boundary prevents silent failures and unexpected physics behavior.

---

## Privacy Considerations

### Data Collection
**None.** This application:
- Does not collect analytics
- Does not send data to external servers
- Does not use cookies (beyond localStorage for state)
- Does not track users

### Referrer Policy
**Setting:** `no-referrer` (meta tag in `index.html`)  
**Rationale:** If this app is ever embedded in a page with external links, the referrer policy prevents leaking the origin URL.

---

## Module Trust Model

| Module | Responsibility | Untrusted Input | Security Controls |
|---|---|---|---|
| `dice.js` | Dice rolling, pool building, outcome counting | User dice counts, random source | `normalizeDiceCount()`, bounded presets, cryptoRandom default |
| `pool-persistence.js` | localStorage read/write | Raw localStorage values, user input | Size guard, allowlist, schema validation |
| `roll-session.js` | Roll/push state transitions | None (internal state only) | Validation at output boundary (`isValidRollRequest`, `isValidResolution`) |
| `strain-points.js` | Strain accumulation, bane tracking | Previous/current roll outcomes | Normalization, bounded increments |
| `physics.js` | Physics simulation helpers | None (deterministic physics) | Clamping, bounds enforcement |
| `textures.js` | Canvas texture generation | None (procedural only) | Explicit cleanup, disposal tracking |
| `DiceTray3D.jsx` | 3D rendering and physics orchestration | `rollRequest` prop | `isValidRollRequest()` validation |
| `useRollSession.js` | Roll orchestration hook | User actions (onRoll, onPush) | `isValidResolution()` validation, state guards |
| `usePoolSelection.js` | Dice count selection | User input, localStorage | Delegates to `pool-persistence.js` guards |
| `useStrainTracker.js` | Strain point state | Bane increments | `normalizeStrainPoints()` with min 0 |

---

## Threat Model Summary

### In Scope
✅ **Client-side code execution** (XSS, prototype pollution)  
✅ **Data integrity** (localStorage tampering, malformed props)  
✅ **Fairness guarantees** (RNG predictability, timing attacks)  
✅ **Memory safety** (DOM leaks, unbounded allocations)  
✅ **Dependency hygiene** (supply chain attacks)  

### Out of Scope
❌ **Network attacks** (no server, no API calls)  
❌ **Authentication/authorization** (no user accounts)  
❌ **Database security** (no database)  
❌ **Physical device compromise** (browser devtools can always manipulate localStorage)  

### Accepted Risks
⚠️ **Browser extensions** can modify DOM, localStorage, and inject scripts — this is outside application control  
⚠️ **Devtools manipulation** can alter game state — users who cheat are only cheating themselves (no server validation possible)  
⚠️ **`'unsafe-inline'` for styles** in CSP — required by Three.js, mitigated by lack of user-provided CSS  

---

## Security Checklist (Maintenance)

When adding new features or dependencies, verify:

- [ ] No `dangerouslySetInnerHTML` or `eval()` usage
- [ ] No dynamic script loading or `new Function()`
- [ ] User input is normalized/validated before use
- [ ] localStorage reads use size guard + allowlist + schema validation
- [ ] New random sources default to `cryptoRandom` (override only for tests)
- [ ] Canvas elements are nulled after texture creation
- [ ] Three.js objects are disposed in cleanup effects
- [ ] Component prop shapes are validated at boundaries
- [ ] Production dependencies are pinned (no caret ranges)
- [ ] Run `npm audit` before release

---

## Incident Response

**If a security issue is discovered:**

1. **Assess scope:** Is it exploitable in production? What data/functionality is at risk?
2. **Mitigate immediately:** Apply minimal fix to block the attack vector
3. **Test thoroughly:** Verify the fix doesn't break functionality
4. **Document:** Update this file with lessons learned
5. **Release:** Deploy patched version and notify users if necessary

**Contact:** (No public reporting channel; this is a personal project. File a GitHub issue with "[SECURITY]" prefix if this code is published.)

---

## References

- **Content Security Policy:** [MDN CSP Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- **crypto.getRandomValues:** [MDN Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
- **Prototype Pollution:** [OWASP Prototype Pollution](https://owasp.org/www-community/attacks/Prototype_Pollution)
- **Three.js Disposal Best Practices:** [Three.js Manual - Disposing](https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects)

---

## Changelog

### 2024 - Initial Security Hardening
- Replaced `Math.random()` with `crypto.getRandomValues()` for dice fairness
- Added strict Content Security Policy
- Implemented localStorage size guard and allowlist
- Pinned production dependency versions
- Added rollRequest/resolution validation at component boundaries
- Verified prototype pollution protection patterns
- Documented threat model and security controls
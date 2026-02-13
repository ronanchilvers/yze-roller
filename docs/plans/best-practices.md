# Best Practices Improvement Plan

Targeted tasks to align the project with modern frontend standards, improve developer experience, and ensure long-term maintainability.

> **Updated** after completion of the Code Quality plan. Module references, scope, and priorities reflect the decomposed codebase structure (9 lib modules, 4 hooks, 1 component, 77 tests).

---

## Current codebase snapshot (for reference)

| Area | Files | Notes |
|---|---|---|
| Lib modules | `dice.js`, `dice-visuals.js`, `face-mapping.js`, `physics.js`, `textures.js`, `viewport-bounds.js`, `roll-session.js`, `strain-points.js`, `pool-persistence.js` | Most have JSDoc on exports |
| Hooks | `useRollSession.js`, `usePoolSelection.js`, `useStrainTracker.js`, `useLatestRef.js` | JSDoc on hook signatures |
| Components | `DiceTray3D.jsx` (~495 lines), `App.jsx` (~204 lines) | No prop validation |
| Tests | 9 test files, 77 tests (`node:test` + `node:assert/strict`) | Shared helper in `test-helpers.js` |
| Styling | `App.css` (sectioned with comments), `index.css` (reset) | Single flat CSS file |
| Config | `vite.config.js` (minimal), `package.json` (explicit Vite paths) | No linter, formatter, or CI |
| Imports | `.js` extensions used consistently (ESM-correct) | `import * as THREE` / `import * as CANNON` in 4 files |

---

## 1. Add a linter and formatter

No ESLint or Prettier configuration exists. Code style is manually maintained.

- [ ] Add ESLint with `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y`
- [ ] Add Prettier with a minimal config (double quotes — matches existing style throughout all 9 lib modules, 4 hooks, and 2 components)
- [ ] Add `"lint"` and `"format"` scripts to `package.json`
- [ ] Run the formatter once across the entire `src/` directory and commit the result as a standalone formatting commit
- [ ] Add `import/extensions` ESLint rule set to `"always"` to enforce the existing `.js` extension convention
- [ ] Consider adding a pre-commit hook via `lint-staged` + `husky` (or a lightweight alternative like `lefthook`)

---

## 2. Add an error boundary around the 3D canvas

WebGL failures (unsupported hardware, context loss, driver bugs) will crash the entire React tree. The `<Suspense>` wrapper in `App.jsx` only handles loading, not runtime errors.

- [ ] Create `src/components/ErrorBoundary.jsx` — a class component that catches errors and renders a friendly fallback message
- [ ] Wrap the `<Suspense>` + `<DiceTray3D>` block inside the error boundary
- [ ] Display a clear message like "3D rendering failed — try refreshing" rather than a white screen
- [ ] Log the error details to the console for debugging
- [ ] Keep the component small (~30 lines) — it only needs `componentDidCatch` and a state-driven fallback render

---

## 3. Replace custom test runner with Vitest

`run-tests.mjs` shells out to `node --test`, bypassing Vite's module resolution and making it impossible to test anything that imports browser APIs or JSX.

Current test scope (9 files, 77 tests):
- `dice.test.js` (14 tests)
- `dice-visuals.test.js` (1 test)
- `face-mapping.test.js` (11 tests)
- `physics.test.js` (18 tests)
- `viewport-bounds.test.js` (15 tests)
- `pool-persistence.test.js` (4 tests)
- `roll-session.test.js` (5 tests)
- `strain-points.test.js` (9 tests)
- `test-helpers.js` (shared utility, 0 tests of its own)

Migration steps:

- [ ] Add `vitest` as a dev dependency
- [ ] Configure it in `vite.config.js` with `test: { environment: 'jsdom' }`
- [ ] Migrate existing `node:test` + `node:assert/strict` tests to Vitest's `describe`/`it`/`expect` API (or keep `assert` — Vitest supports both)
- [ ] Update `test-helpers.js` imports if the API changes
- [ ] Replace the `"test"` script in `package.json` with `vitest run`
- [ ] Remove `src/run-tests.mjs`
- [ ] Verify all 77 existing tests pass under Vitest before merging
- [ ] Unlocks future testing of `DiceTray3D.jsx` and hooks with jsdom + `@testing-library/react`

---

## 4. Simplify `package.json` scripts

The current scripts use explicit `node ./node_modules/vite/bin/vite.js` paths instead of relying on `npx` or `node_modules/.bin` resolution.

```json
"dev": "node ./node_modules/vite/bin/vite.js",
"build": "node ./node_modules/vite/bin/vite.js build",
"preview": "node ./node_modules/vite/bin/vite.js preview"
```

- [ ] Change `"dev"` to `"vite"`, `"build"` to `"vite build"`, `"preview"` to `"vite preview"`
- [ ] Verify these work correctly with `npq-hero run dev` / `npq-hero run build` / `npq-hero run preview`

---

## 5. Add prop validation

Component props are completely unvalidated. This makes refactoring risky and debugging harder.

**Existing mitigation:** Most lib modules now have JSDoc on their exports, and the hooks have typed `@returns` annotations. But the component boundary (props passed to `DiceTray3D`) is still untyped.

- [ ] **Option A (minimal):** Add `PropTypes` to `DiceTray3D` for the key props (`dice`, `rollRequest`, `onRollResolved`) — these are the only component-level props in the app
- [ ] **Option B (recommended):** Adopt TypeScript incrementally:
  - Rename lib modules to `.ts` first (pure logic, no JSX): `dice.ts`, `roll-session.ts`, `strain-points.ts`, `pool-persistence.ts`, `dice-visuals.ts`
  - Then hooks to `.ts`: `useLatestRef.ts`, `useStrainTracker.ts`, `usePoolSelection.ts`, `useRollSession.ts`
  - Then components to `.tsx`: `DiceTray3D.tsx`, `App.tsx`
  - Add a `tsconfig.json` with `allowJs: true` and `strict: false` to avoid a big-bang migration
  - Physics/3D modules (`physics.ts`, `face-mapping.ts`, `textures.ts`, `viewport-bounds.ts`) can follow later since they depend on Three.js/cannon-es types
- [ ] Either option should cover the `rollRequest` shape — the contract between `useRollSession` and `DiceTray3D` is the most refactoring-sensitive boundary

---

## 6. Add accessibility improvements

ARIA attributes are present but incomplete, and there is no automated validation.

- [ ] Add `eslint-plugin-jsx-a11y` (covered in task 1) and fix any violations
- [ ] Add `aria-busy={isRolling}` to the dice tray section in `App.jsx` so screen readers announce the rolling state
- [ ] Ensure the history dropdown can be dismissed with `Escape` and is focus-trapped when open
- [ ] Add a skip-to-content link for keyboard users (or verify tab order is logical without one)
- [ ] Test with a screen reader (VoiceOver on macOS) and document any issues found

---

## 7. Add a CI pipeline

No automated checks run on commits or pull requests.

- [ ] Create `.github/workflows/ci.yml` with:
  - Install dependencies (`npq-hero ci` or `npm ci`)
  - Run lint (`npq-hero run lint`) — requires task 1
  - Run tests (`npq-hero run test`) — all 77+ tests
  - Run build (`npq-hero run build`) to catch compile errors
- [ ] Configure the workflow to run on `push` and `pull_request` to `main`
- [ ] Add a status badge to `README.md`

---

## 8. Improve bundle efficiency

`three`, `cannon-es`, and `@react-three/fiber` are large. The current Vite config does nothing to optimise the bundle.

Current bundle (from latest build):
- `index.js`: 153.71 KB (gzip: 49.63 KB)
- `DiceTray3D.js`: 951.89 KB (gzip: 260.41 KB) ⚠️
- `index.css`: 5.18 KB (gzip: 1.76 KB)

Steps:

- [ ] Add `rollup-plugin-visualizer` (or `vite-bundle-analyzer`) as a dev dependency and add an `"analyze"` script
- [ ] Run it once to establish a baseline bundle size and document it in the repo
- [ ] Configure Vite's `build.rollupOptions.output.manualChunks` to split `three` and `cannon-es` into separate chunks for better caching
- [ ] Audit Three.js imports — `import * as THREE from 'three'` appears in 4 files (`DiceTray3D.jsx`, `face-mapping.js`, `textures.js`, `viewport-bounds.js`). Switch to named imports (e.g., `import { Vector3, Quaternion, MathUtils, ... } from 'three'`) to enable better tree-shaking
- [ ] Same for cannon-es: `import * as CANNON from 'cannon-es'` appears in 3 files (`DiceTray3D.jsx`, `face-mapping.js`, `physics.js`). Switch to named imports
- [ ] Re-measure after changes to confirm impact

---

## 9. Improve the loading and empty states

The `<Suspense>` fallback is a plain `<div>` with text. The empty tray state is a single line of copy.

- [ ] Design a lightweight loading skeleton or spinner for the 3D tray that matches the app's visual style
- [ ] Add a more informative empty state to the tray: instructions or a visual prompt to roll
- [ ] Ensure both states are visible on slow connections (test with Chrome DevTools network throttling)

---

## 10. Document the architecture

The project has a minimal `README.md` with only run commands. There is no architectural overview.

**Partially addressed:** Most public functions in `src/lib/` modules now have JSDoc comments from the code quality refactoring. The remaining gaps are the component and hook files.

- [ ] Add a `docs/architecture.md` covering:
  - High-level data flow: user input → `usePoolSelection` → `useRollSession` → `DiceTray3D` (physics simulation) → `onRollResolved` → session state update
  - Module responsibilities (use the table from the Security plan as a starting point)
  - The `rollRequest` / `onRollResolved` contract between `useRollSession` and `DiceTray3D`
  - How strain points flow through the system (`useStrainTracker` → `buildCountsWithStrain` → pool)
- [ ] Add remaining JSDoc comments to:
  - `DiceTray3D.jsx` internal helpers and the `DicePhysicsScene` component
  - Hook parameters in `usePoolSelection.js` (already has `@returns` but no `@param` detail)
- [ ] Add a brief description of the Year Zero Engine dice mechanics for contributors unfamiliar with the system

---

## 11. Adopt consistent module import style ✅

> **Completed during the code quality refactoring.** All files now consistently use `.js` extensions in imports (ESM-correct). No mixed styles remain.

- [x] `.js` extensions used in all import paths across `src/lib/`, `src/hooks/`, and `src/components/`
- [ ] Add an ESLint rule (`import/extensions: ["error", "always"]`) to enforce the convention going forward (deferred to task 1)

---

## 12. Add a `robots.txt` and basic PWA metadata

If the app is deployed publicly, basic web standards apply. The current `index.html` is minimal (no meta description, no favicon, no theme colour).

- [ ] Add `public/robots.txt` (even if just `User-agent: * Allow: /`)
- [ ] Add a favicon and `<meta name="description">` to `index.html`
- [ ] Add `<meta name="theme-color" content="#bc5e2c">` matching the app's `--accent` colour
- [ ] Consider a basic `manifest.json` for add-to-homescreen support on mobile

---

## Summary

| Area | Current | Target |
|---|---|---|
| Linting / formatting | None | ESLint + Prettier, enforced in CI |
| Error handling | No error boundary | Graceful WebGL failure recovery |
| Test runner | Custom `node --test` shim (77 tests) | Vitest with jsdom environment (unlocks component/hook tests) |
| Type safety | JSDoc on most lib exports | PropTypes minimum, TypeScript stretch goal |
| CI | None | GitHub Actions: lint → test → build |
| Bundle size | 951 KB DiceTray3D chunk, `import *` in 4+ files | Measured baseline, chunked vendor code, named imports |
| Documentation | JSDoc on lib modules, no architecture doc | Architecture doc, remaining JSDoc, game-mechanic primer |
| Import style | ✅ Consistent `.js` extensions | ESLint rule to enforce |
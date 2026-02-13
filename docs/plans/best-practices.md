# Best Practices Improvement Plan

Targeted tasks to align the project with modern frontend standards, improve developer experience, and ensure long-term maintainability.

---

## 1. Add a linter and formatter

No ESLint or Prettier configuration exists. Code style is manually maintained.

- [ ] Add ESLint with `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y`
- [ ] Add Prettier with a minimal config (single quotes or double — match existing style which uses double)
- [ ] Add `"lint"` and `"format"` scripts to `package.json`
- [ ] Run the formatter once across the entire `src/` directory and commit the result as a standalone formatting commit
- [ ] Consider adding a pre-commit hook via `lint-staged` + `husky` (or a lightweight alternative like `lefthook`)

---

## 2. Add an error boundary around the 3D canvas

WebGL failures (unsupported hardware, context loss, driver bugs) will crash the entire React tree. The `<Suspense>` wrapper only handles loading, not runtime errors.

- [ ] Create `src/components/ErrorBoundary.jsx` — a class component that catches errors and renders a friendly fallback message
- [ ] Wrap the `<Suspense>` + `<DiceTray3D>` block inside the error boundary
- [ ] Display a clear message like "3D rendering failed — try refreshing" rather than a white screen
- [ ] Log the error details to the console for debugging

---

## 3. Replace custom test runner with Vitest

`run-tests.mjs` shells out to `node --test`, bypassing Vite's module resolution and making it impossible to test anything that imports browser APIs or JSX.

- [ ] Add `vitest` as a dev dependency
- [ ] Configure it in `vite.config.js` with `test: { environment: 'jsdom' }`
- [ ] Migrate existing `node:test` + `node:assert/strict` tests to Vitest's `describe`/`it`/`expect` API (or keep `assert` — Vitest supports both)
- [ ] Replace the `"test"` script in `package.json` with `vitest run`
- [ ] Remove `src/run-tests.mjs`
- [ ] Verify all existing tests pass under Vitest before merging

---

## 4. Simplify `package.json` scripts

The current scripts use explicit `node ./node_modules/vite/bin/vite.js` paths instead of relying on `npx` or `node_modules/.bin` resolution.

- [ ] Change `"dev"` to `"vite"`, `"build"` to `"vite build"`, `"preview"` to `"vite preview"`
- [ ] Verify these work correctly with `npq-hero run dev` / `npq-hero run build` / `npq-hero run preview`

---

## 5. Add prop validation

Component props are completely unvalidated. This makes refactoring risky and debugging harder.

- [ ] **Option A (minimal):** Add `PropTypes` to `DiceTray3D` and `App` for the key props (`dice`, `rollRequest`, `onRollResolved`)
- [ ] **Option B (recommended):** Adopt TypeScript incrementally — rename files to `.tsx`, add a `tsconfig.json`, and type the core lib modules first (`dice.ts`, `roll-session.ts`, `strain-points.ts`)
- [ ] If going with TypeScript, start with `allowJs: true` and `strict: false` to avoid a big-bang migration

---

## 6. Add accessibility improvements

ARIA attributes are present but incomplete, and there is no automated validation.

- [ ] Add `eslint-plugin-jsx-a11y` (covered in task 1) and fix any violations
- [ ] Add `aria-busy={isRolling}` to the dice tray section so screen readers announce the rolling state
- [ ] Ensure the history dropdown can be dismissed with `Escape` and is focus-trapped when open
- [ ] Add a skip-to-content link for keyboard users (or verify tab order is logical without one)
- [ ] Test with a screen reader (VoiceOver on macOS) and document any issues found

---

## 7. Add a CI pipeline

No automated checks run on commits or pull requests.

- [ ] Create `.github/workflows/ci.yml` with:
  - Install dependencies (`npq-hero ci` or `npm ci`)
  - Run lint (`npq-hero run lint`)
  - Run tests (`npq-hero run test`)
  - Run build (`npq-hero run build`) to catch compile errors
- [ ] Configure the workflow to run on `push` and `pull_request` to `main`
- [ ] Add a status badge to `README.md`

---

## 8. Improve bundle efficiency

`three`, `cannon-es`, and `@react-three/fiber` are large. The current Vite config does nothing to optimise the bundle.

- [ ] Add `rollup-plugin-visualizer` (or `vite-bundle-analyzer`) as a dev dependency and add an `"analyze"` script
- [ ] Run it once to establish a baseline bundle size and document it in the repo
- [ ] Configure Vite's `build.rollupOptions.output.manualChunks` to split `three` and `cannon-es` into separate chunks for better caching
- [ ] Audit Three.js imports — import only what is needed (e.g., `import { Vector3, Quaternion, ... } from 'three'`) instead of `import * as THREE from 'three'` to enable better tree-shaking
- [ ] Same for cannon-es: `import { World, Body, ... } from 'cannon-es'` instead of `import * as CANNON from 'cannon-es'`

---

## 9. Improve the loading and empty states

The `<Suspense>` fallback is a plain `<div>` with text. The empty tray state is a single line of copy.

- [ ] Design a lightweight loading skeleton or spinner for the 3D tray that matches the app's visual style
- [ ] Add a more informative empty state to the tray: instructions or a visual prompt to roll
- [ ] Ensure both states are visible on slow connections (test with Chrome DevTools network throttling)

---

## 10. Document the architecture

The project has a minimal `README.md` with only run commands. There is no architectural overview.

- [ ] Add a `docs/architecture.md` covering:
  - High-level data flow (user input → dice pool → physics simulation → resolved roll → session state)
  - Module responsibilities (`lib/dice.js`, `lib/roll-session.js`, `lib/strain-points.js`, etc.)
  - How the 3D tray communicates results back to the app (the `rollRequest` / `onRollResolved` contract)
- [ ] Add inline JSDoc comments to all public functions in `src/lib/` modules
- [ ] Add a brief description of the Year Zero Engine dice mechanics for contributors unfamiliar with the system

---

## 11. Adopt consistent module import style

Some files use `.js` extensions in imports, some don't. Vite resolves both, but consistency matters.

- [ ] Pick one convention (with extension is more ESM-correct) and apply it everywhere
- [ ] Add an ESLint rule to enforce the choice (`import/extensions`)

---

## 12. Add a `robots.txt` and basic PWA metadata

If the app is deployed publicly, basic web standards apply.

- [ ] Add `public/robots.txt` (even if just `User-agent: * Allow: /`)
- [ ] Add a favicon and `<meta name="description">` to `index.html`
- [ ] Add `<meta name="theme-color">` matching the app's accent colour
- [ ] Consider a basic `manifest.json` for add-to-homescreen support on mobile

---

## Summary

| Area | Current | Target |
|---|---|---|
| Linting / formatting | None | ESLint + Prettier, enforced in CI |
| Error handling | No error boundary | Graceful WebGL failure recovery |
| Test runner | Custom `node --test` shim | Vitest with jsdom environment |
| Type safety | None | PropTypes minimum, TypeScript stretch goal |
| CI | None | GitHub Actions: lint → test → build |
| Bundle size | Unknown, unoptimised | Measured baseline, chunked vendor code, targeted imports |
| Documentation | Commands only | Architecture doc, JSDoc, game-mechanic primer |
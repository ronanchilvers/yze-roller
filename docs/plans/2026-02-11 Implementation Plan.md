# 2026-02-11 Implementation Plan

## Inputs
- `/Users/ronan/Agents/Local.AGENTS.md`
- `/Users/ronan/.codex/worktrees/d97f/yze-roller/docs/plans/2026-02-11 Initial Build.md`

## Execution Constraints
- Keep implementation work in `src/` unless explicitly asked otherwise.
- Do not add dependencies, change Vite config, or do large refactors without approval.
- Do not run `npq-hero`/`npm` commands without explicit permission.

## Command Setup (Run First, When Authorized)
Use `npq-hero` first. If not found, resolve the binary via `asdf`.

```bash
command -v npq-hero || /Users/ronan/.asdf/bin/asdf which npq-hero
command -v npm || /Users/ronan/.asdf/bin/asdf which npm
```

Primary project commands (from repo instructions):

```bash
npq-hero ci
npq-hero run dev
npq-hero run build
npq-hero run preview
```

If `npq-hero` is not on `PATH`, run the resolved absolute path returned by `asdf` instead.

Target test commands to add during implementation:

```bash
npq-hero run test
npq-hero run test -- --run
```

## Phase 1: App Skeleton and Safe Defaults
Goal: Create a consistent, minimal React/Vite app shell with dice control UI and no gameplay side effects.

Scope:
- Create/confirm base app files (`src/App.jsx`, `src/main.jsx`, `src/*.css`).
- Build a responsive single-page iframe-friendly layout.
- Add controls for Attribute and Skill dice count.
- Enforce minimum/maximum UI constraints:
  - Attribute dice minimum is `1`.
  - Skill dice minimum is `0`.
- Add Strain Points display area (read-only placeholder).

Done when:
- App renders correctly on desktop/mobile.
- No runtime errors.
- Controls prevent invalid values.

Commands (when authorized):
```bash
npq-hero run dev
npq-hero run build
```

## Phase 2: Unit Test Harness and Baseline Tests
Goal: Establish a repeatable unit test workflow early so each subsequent phase can be validated quickly.

Approval gate:
- Confirm test dependency choices before installing packages or changing config.

Scope:
- Add unit test tooling and scripts (prefer lightweight defaults compatible with React + Vite).
- Add deterministic helpers for testability where needed (for example RNG injection/mocking boundaries).
- Create baseline tests for:
  - Dice count validation rules (Attribute >= 1, Skill >= 0).
  - Roll classification rules (6 = success, 1 = bane).
  - Push eligibility rule (only non-1/non-6 reroll).
  - Non-throwing behavior for malformed inputs.
- Document test run command(s) in `README.md`.

Done when:
- `npq-hero run test -- --run` executes successfully.
- Baseline rule tests pass and are understandable for future extension.
- App still builds cleanly.

Commands (when authorized):
```bash
npq-hero ci
npq-hero run test -- --run
npq-hero run build
```

## Phase 3: Core Roll Engine (Pure Logic First)
Goal: Implement deterministic roll and push logic in isolated helpers before wiring UI effects.

Scope:
- Add pure helper module(s) for:
  - Dice pool creation (Attribute + Skill + Strain).
  - Roll result classification (`success` on 6, `bane` on 1).
  - Push logic (re-roll only non-1/non-6 dice).
  - Aggregation across original + pushed dice.
  - `with Strain` detection when any Strain die rolls `1`.
- Add defensive guards for malformed/missing state inputs.

Done when:
- Helpers handle empty/malformed inputs without throwing.
- Push rules exactly match the behavior goals.
- Unit tests cover normal and edge-case roll/push paths.
- App still builds cleanly.

Commands (when authorized):
```bash
npq-hero run dev
npq-hero run test -- --run
npq-hero run build
```

## Phase 4: Stateful UI Integration and Persistence
Goal: Wire the core logic into UI state and persist per-user convenience settings.

Scope:
- Connect roll engine to Roll button.
- Store/reuse last selected Attribute and Skill counts (local persistence).
- Track current roll, previous roll, and push eligibility state.
- Disable push action when no valid push target exists.
- Keep all state updates guarded and non-throwing.

Done when:
- User can roll repeatedly with persisted counts.
- Push action is only available when valid.
- UI and state stay consistent across refreshes.
- Unit tests cover state transitions for roll/push availability and persisted values.

Commands (when authorized):
```bash
npq-hero run dev
npq-hero run test -- --run
npq-hero run build
```

## Phase 5: Strain Points Rules End-to-End
Goal: Implement full Strain Points lifecycle in local app behavior.

Scope:
- Include current Strain Points as Strain dice in each new roll.
- On push, add banes to Strain Points total.
- Show Strain Points clearly and update immediately after push resolution.
- Ensure subsequent rolls include updated Strain dice count.

Done when:
- Strain Points math matches behavior goals over multiple roll/push cycles.
- Consecutive rolls remain internally consistent.
- Unit tests verify Strain accumulation and use in subsequent rolls.

Commands (when authorized):
```bash
npq-hero run dev
npq-hero run test -- --run
npq-hero run build
```

## Phase 6: 3D Dice Tray Integration
Goal: Replace plain result rendering with 3D dice in a tray while preserving roll correctness.

Approval gate:
- Confirm dependency choice before adding packages or changing Vite config.

Scope:
- Add tray viewport suitable for iframe usage.
- Map logical dice outcomes to 3D dice visuals (green/yellow/red).
- Ensure push only re-animates dice eligible for reroll.
- Preserve accessibility with a textual results summary alongside visuals.

Done when:
- Roll and push outcomes in 3D match core logic exactly.
- App remains usable on smaller viewport sizes.
- Existing unit tests remain green (logic unaffected by presentation layer changes).

Commands (when authorized):
```bash
npq-hero ci
npq-hero run dev
npq-hero run test -- --run
npq-hero run build
```

## Phase 7: Owlbear Rodeo Integration Layer
Goal: Integrate extension-facing behavior while preserving local development fallback.

Scope:
- Add adapter boundary for Owlbear APIs (toast + shared state calls).
- Broadcast roll summaries to all users:
  - Roll: `"X successes"`
  - Push: `"X successes, X banes (with Strain)"` when applicable
- Sync Strain Points through shared/global state for multi-user consistency.
- Keep safe fallback behavior when Owlbear runtime is unavailable.

Done when:
- Toast payloads and Strain sync behavior are correct in extension context.
- Local dev mode does not crash without Owlbear APIs.
- Unit tests cover formatting and adaptation logic that can run outside Owlbear runtime.

Commands (when authorized):
```bash
npq-hero run dev
npq-hero run test -- --run
npq-hero run build
npq-hero run preview
```

## Phase 8: Hardening and Release Readiness
Goal: Final consistency pass for reliability, accessibility, and handoff quality.

Scope:
- Audit for null/undefined safety across render paths and state transitions.
- Verify keyboard and screen-reader basics for controls/actions.
- Validate responsive behavior for iframe-sized layouts.
- Clean up UI copy and edge-case states.
- Update `README.md` with run instructions and feature summary.

Done when:
- No known crash paths under malformed or missing data.
- Unit test suite passes in one-shot mode.
- Build succeeds and preview smoke test passes.
- Implementation is ready for Owlbear extension packaging follow-up.

Commands (when authorized):
```bash
npq-hero run test -- --run
npq-hero run build
npq-hero run preview
```

## Session-by-Session Handoff Rule
At the end of each phase, leave the code in a usable state with:
- Passing build.
- Passing one-shot unit tests once Phase 2 is complete.
- No partially wired UI controls.
- Brief phase summary in the PR/notes describing what is complete and what is intentionally deferred to the next phase.

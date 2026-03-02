# GM Name on Host Session Creation Plan

## Goal
Allow a GM to enter their name when creating a session, send it with the create-session request, and keep the host flow behavior stable (success handoff, loading states, and error handling).

## Scope
- In scope: host UI form fields, client validation, create-session request payload, and tests.
- In scope: contract/doc updates needed so frontend and backend use the same field name and validation limits.
- Out of scope: major route changes, multiplayer reducer changes, or new dependencies.

## Current State Snapshot
- `src/components/HostSessionView.jsx` currently collects only `session_name` and posts `POST /sessions` with `{ session_name }`.
- `src/components/HostSessionView.jsx` maps `VALIDATION_ERROR` to a session-name-only message.
- `src/components/HostSessionView.test.jsx` currently asserts only the session-name payload path.
- `src/App.jsx` host handoff expects normalized auth `{ sessionToken, sessionId, role: "gm", self }` and then relies on existing session bootstrap.
- Contract docs (`docs/plans/multiplayer-api-contract-and-build-spec.md`) currently define `POST /api/sessions` with only `session_name`.

## Target Behavior
- Host form has a required GM name input.
- Submit is blocked client-side when GM name is blank after trim.
- `POST /sessions` body includes both:
  - `session_name` (trimmed, 1..128)
  - `display_name` (trimmed, 1..64)
- Existing host success path stays intact (set in-memory auth, transition to session bootstrap).
- Validation error copy reflects both constraints so users can self-correct.

## Implementation Strategy (AI-Executable)

### Step 1: Align request contract and naming
1. Use `display_name` as the new GM name request field for `POST /api/sessions` (same key used by join flow to reduce schema drift).
2. Update `docs/plans/multiplayer-api-contract-and-build-spec.md`:
   - Request schema for `POST /api/sessions` includes `display_name`.
   - Validation includes trimmed length 1..64 and control-character rejection parity with join validation.
3. If maintained in parallel, update `docs/plans/server-side-implementation-outline.md` and `docs/plans/client-side-implementation-spec.md` so all implementation docs match.

Acceptance criteria:
- One canonical field name is documented across all relevant docs.
- Validation constraints are explicit and unambiguous.

### Step 2: Extend HostSessionView form state and validation
1. Edit `src/components/HostSessionView.jsx`.
2. Add new local state for GM name input.
3. Add required input block above session name:
   - Label text: `GM Name` (or `Display Name` if product copy prefers consistency with join route).
   - `id/name`: stable identifier (for test targeting).
   - `maxLength={64}`, `autoComplete="nickname"`, existing `join-input` class for style consistency.
4. In `handleSubmit`:
   - Trim both GM name and session name.
   - Show targeted validation message when GM name is missing.
   - Keep existing submit lock (`isSubmitting`) behavior.
5. Request payload becomes:
   - `{ session_name: trimmedSessionName, display_name: trimmedGmName }`.

Acceptance criteria:
- No submit call occurs when either field is empty after trim.
- Existing invite-link fallback form still works unchanged.

### Step 3: Update error messaging for combined validation
1. In `mapCreateSessionErrorCodeToMessage`, update `VALIDATION_ERROR` copy to mention both fields (session name and GM name constraints).
2. Keep existing `RATE_LIMITED` and default network/server fallback behavior unchanged.

Acceptance criteria:
- Validation errors do not mislead users into thinking only session name can fail.

### Step 4: Keep auth handoff stable and defensive
1. Keep `normalizeCreateSessionSuccessData` defensive checks for `gm_token` and `session_id`.
2. Do not require new response fields for this UI change.
3. Preserve return shape consumed by `App` host handoff.

Acceptance criteria:
- `onHostSuccess` payload remains backward-compatible with current `App` logic.

### Step 5: Add and update focused tests
1. Update `src/components/HostSessionView.test.jsx`:
   - `renders host game form` should assert GM name input exists.
   - Success test should populate GM name + session name and assert `apiPost` receives both fields.
   - Add test: blank GM name blocks submit and shows local error.
   - Keep invite-link handoff test unchanged to prevent regression.
2. Review `src/App.join-flow.test.jsx`:
   - No structural changes expected because host view is mocked, but confirm host handoff test still reflects unchanged auth shape.

Acceptance criteria:
- Host view tests cover happy path and validation failure for GM name.
- Existing App join-flow tests continue to pass without host contract breakage.

### Step 6: Optional UX polish (only if needed after test pass)
1. Ensure tab order and focus rings remain correct for the added input.
2. Confirm create button disabled state still maps only to `isSubmitting`.
3. Confirm no layout break at mobile widths using existing join-shell styles.

Acceptance criteria:
- Added field integrates into current join-shell layout without accessibility regressions.

## File Change Plan
- `src/components/HostSessionView.jsx`
- `src/components/HostSessionView.test.jsx`
- `docs/plans/multiplayer-api-contract-and-build-spec.md`
- `docs/plans/server-side-implementation-outline.md` (if this repo keeps it as an active source)
- `docs/plans/client-side-implementation-spec.md` (if this repo keeps it as an active source)

## Verification Plan
Run after user permission for `npq-hero` commands:
1. `npq-hero run test src/components/HostSessionView.test.jsx`
2. `npq-hero run test src/App.join-flow.test.jsx`
3. `npq-hero run test`
4. `npq-hero run build`
5. `npq-hero run lint`

Manual smoke checks:
1. Host form blocks empty GM name.
2. Host form submits both fields when valid.
3. Invite-link quick path from host view still navigates correctly.

## Risks and Mitigations
- Risk: backend does not yet accept `display_name` on create.
  - Mitigation: land contract/doc update first; implement UI against that canonical contract.
- Risk: ambiguous `VALIDATION_ERROR` copy confuses users.
  - Mitigation: update error message to mention both fields and limits.
- Risk: host form regression could break invite-link fallback.
  - Mitigation: keep invite-link tests intact and unchanged.

## Definition of Done
- GM can enter a name in host creation UI.
- Create-session request includes `display_name`.
- Client-side and server-side constraints are documented consistently.
- HostSessionView tests cover GM-name validation and request payload.
- Existing host handoff/session bootstrap behavior remains unchanged.

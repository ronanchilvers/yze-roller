# GM Name Host Session UI Plan

## Summary
Add a required GM name input to host session creation and submit it as `display_name` alongside `session_name`.  
This plan is frontend-only and can be executed in parallel with API implementation.

## Scope
- In scope: host UI fields, client-side validation, request payload shape, error copy, and tests.
- Out of scope: server-side persistence and endpoint implementation details.

## Current State
- `src/components/HostSessionView.jsx` currently submits only `{ session_name }` to `POST /sessions`.
- Host success flow normalizes response to `{ sessionToken, sessionId, role: "gm", self: null }` and is consumed by `src/App.jsx`.
- Host view tests cover existing session-name submit path and invite-link fallback path.

## Target Behavior
1. Host form includes a required GM name field.
2. Submit is blocked if GM name is blank after trimming.
3. Create-session request payload becomes:
```json
{
  "session_name": "Streetwise Night",
  "display_name": "GM Nova"
}
```
4. Existing host success handoff behavior remains unchanged.
5. Invite-link fallback behavior remains unchanged.

## Public Interface/Contract Usage
- Endpoint: `POST /sessions` (via existing `apiPost` call).
- Request fields:
  - `session_name` (trimmed, `1..128`)
  - `display_name` (trimmed, `1..64`)
- Validation error handling remains code-based with `VALIDATION_ERROR`.
- No changes to auth normalization output shape consumed by `App`.

## Implementation Plan

### Step 1: Extend host form state and inputs
1. Edit `src/components/HostSessionView.jsx`.
2. Add state for GM name input (for example `gmName`).
3. Add a labeled text input above session name:
   - Label: `GM Name`
   - `id`/`name`: stable identifier for tests
   - `maxLength={64}`
   - `autoComplete="nickname"`
   - class `join-input` to reuse current styling

### Step 2: Add submit-time validation
1. In `handleSubmit`, trim both `gmName` and `sessionName`.
2. If trimmed GM name is empty, set user-facing error and abort submit.
3. Keep existing session-name empty check.
4. Keep existing `isSubmitting` guard and pending button behavior.

### Step 3: Update request payload
1. Update `apiPost("/sessions", ...)` body to include both:
   - `session_name: trimmedSessionName`
   - `display_name: trimmedGmName`
2. Keep existing success normalization (`gm_token`, `session_id`) unchanged.

### Step 4: Update validation error copy
1. Update `mapCreateSessionErrorCodeToMessage("VALIDATION_ERROR")` copy so it reflects both field constraints, not just session name.
2. Keep `RATE_LIMITED` and generic failure copy unchanged.

### Step 5: Keep non-target behavior stable
1. Do not change invite-link parsing flow in host view.
2. Do not change `onHostSuccess` shape or `App` host handoff behavior.
3. Do not add feature flags or temporary mock fallbacks.

## File-Level Changes
- `src/components/HostSessionView.jsx`
- `src/components/HostSessionView.test.jsx`
- Optional contract-alignment docs if owned by frontend stream:
  - `docs/plans/multiplayer-api-contract-and-build-spec.md`
  - `docs/plans/client-side-implementation-spec.md`

## Test Plan

### Component Tests (`src/components/HostSessionView.test.jsx`)
1. Form render test asserts GM name input exists.
2. Success submit test populates GM name + session name and asserts:
```js
apiPost("/sessions", {
  session_name: "Streetwise Night",
  display_name: "GM Nova"
})
```
3. Blank GM name test:
   - Submit with empty GM name
   - Assert API is not called
   - Assert visible validation message
4. Existing session-name validation test still passes.
5. Invite-link submit test still passes unchanged.

### App Flow Safety (`src/App.join-flow.test.jsx`)
1. Confirm host success handoff test remains valid because host auth shape is unchanged.
2. No behavior changes expected in join/session routing tests.

## Acceptance Criteria
1. Host UI requires GM name before create-session submit.
2. Request payload includes `display_name` and `session_name`.
3. Validation feedback is accurate for both fields.
4. Host success handoff and session bootstrap triggers remain unchanged.
5. Invite-link fallback from host view remains intact.

## Parallelization Notes
- UI team can implement immediately using fixed payload field `display_name`.
- No mock/fallback branch is included; this is contract-first implementation.
- Final integration verification with API should confirm submitted GM name appears as `self.display_name` in session bootstrap payload.

## Assumptions and Defaults
- Label uses `GM Name` for host clarity.
- Canonical request key is `display_name`.
- Client-side max lengths mirror contract (`64` for GM name, `128` for session name).
- No new dependencies are needed.

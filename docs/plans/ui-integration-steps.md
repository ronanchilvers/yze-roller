# UI Integration Steps (Client Multiplayer)

## 1. Build top-level multiplayer UI shell and mode switch
- Add explicit app modes: `host`, `join`, `session`, `auth_lost`.
- Drive mode from route + in-memory auth + `sessionState.status`.
- Target files:
  - `src/App.jsx`
  - `src/App.css`

## 2. Add GM "Host Game" view (session creation)
- Create a form for `session_name` and call `POST /api/sessions`.
- Save returned GM token in memory auth and bootstrap session.
- Target files:
  - `src/lib/session-auth.js`
  - `src/lib/api-client.js`
  - `src/App.jsx`

## 3. Keep `/join#join=...` as player intake and add a no-token fallback
- Reuse existing join route.
- Add a "paste invite link" entry in non-join mode.
- Target files:
  - `src/components/JoinSessionView.jsx`
  - `src/lib/join-session-route.js`

## 4. Create `SessionView` bound to `useMultiplayerSession`
- Render connection status, role badge, session name, scene strain, and player count.
- Call `bootstrapFromAuth` on mount when token exists.
- Target files:
  - `src/hooks/useMultiplayerSession.js`
  - `src/App.jsx`

## 5. Wire dice actions to multiplayer submit actions
- Route local roll/push outcomes to `submitRoll` / `submitPush`.
- Disable controls during pending submit and surface action-level errors.
- Target files:
  - `src/App.jsx`
  - `src/hooks/useRollSession.js`
  - `src/hooks/useMultiplayerSession.js`

## 6. Add a lightweight event feed panel
- Show ordered events from `sessionState.events` (`roll`, `push`, `join`, `leave`, `strain_reset`).
- Include dedupe-safe rendering keyed by `event.id`.
- Target files:
  - `src/lib/multiplayer-event-reducer.js`
  - `src/App.jsx`

## 7. Add GM controls panel (role-gated)
- Add controls for:
  - rotate join link
  - joining enable/disable
  - reset scene strain
  - refresh/revoke players
- Only render when `sessionState.role === "gm"`.
- Target files:
  - `src/hooks/useMultiplayerSession.js`
  - `src/App.jsx`

## 8. Add auth-lost/session-ended view
- On `auth_lost`, show deterministic message and action to clear state.
- Route user back to host/join entry flow.
- Target files:
  - `src/hooks/useMultiplayerSession.js`
  - `src/App.jsx`

## 9. Add UI tests for each flow boundary
- Host create success/failure.
- Join success/failure.
- Polling state indicators.
- GM controls role gating.
- Auth-loss transition.
- Target files:
  - `src/App.join-flow.test.jsx`
  - `src/hooks/useMultiplayerSession.test.jsx`

## 10. Final pass: UX and accessibility
- Add loading states, disabled states, retry actions, and copy join-link action.
- Verify keyboard/focus behavior and readable error states.
- Target files:
  - `src/App.css`
  - `src/App.jsx`

# GM Name Host Session API Plan

## Summary
Add GM display-name capture to `POST /api/sessions` so host creation sets the GM's identity at session bootstrap time.  
This plan is API-only and can be executed independently of frontend implementation.

## Scope
- In scope: request contract, validation, persistence, snapshot visibility, API tests, and contract docs.
- Out of scope: frontend form behavior and client-side validation UX.

## Public API Contract

### Endpoint
- `POST /api/sessions` (unchanged path)

### Request Body
```json
{
  "session_name": "Streetwise Night",
  "display_name": "GM Nova"
}
```

### Validation Rules
- `session_name`: required, trimmed length `1..128`.
- `display_name`: required, trimmed length `1..64`.
- `display_name`: reject control characters (same policy as join `display_name` validation).

### Error Behavior
- Invalid input returns `422` with code `VALIDATION_ERROR`.
- Error envelope remains the standard shape:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed.",
    "details": {
      "field": "display_name"
    }
  }
}
```
- `details` field names/messages may vary by existing server conventions, but must clearly identify failing input.

### Success Behavior
- Response contract remains backward compatible:
```json
{
  "session_id": 7,
  "session_name": "Streetwise Night",
  "joining_enabled": true,
  "gm_token": "<opaque>",
  "join_link": "https://example.com/join#join=<opaque>",
  "created_at": "2026-03-02T14:00:00.000Z"
}
```
- No new required response fields are introduced in this feature.

## Data and Domain Changes
1. Persist the create-session `display_name` as the GM token display name (`token_display_name`) when minting the GM token.
2. Ensure `GET /api/session` returns this stored GM display name in:
   - `self.display_name` for GM-authenticated snapshots.
   - GM row inside `players[]`.
3. Ensure server-side event actor serialization continues to source actor names from token display-name storage, so GM-created events resolve to the chosen GM name.

## Implementation Plan
1. **Update create-session request schema**
   - Add required `display_name` field in request validation for `POST /api/sessions`.
   - Reuse/join existing display-name normalization helpers if available.
2. **Normalize and validate**
   - Trim both `session_name` and `display_name` before validation/persistence.
   - Reject invalid lengths and control characters with `VALIDATION_ERROR`.
3. **Persist GM identity**
   - Include normalized `display_name` when creating the GM token row.
4. **Verify snapshot consistency**
   - Confirm snapshot builder emits GM display name from persisted token identity.
5. **Update contract docs**
   - Update the canonical contract in `docs/plans/multiplayer-api-contract-and-build-spec.md` so `POST /api/sessions` includes `display_name` and validation details.
   - Keep server implementation outline aligned if this repo treats it as active implementation guidance.

## Test Plan

### Contract/API Tests
1. `POST /api/sessions` returns `201` for valid `session_name` + `display_name`.
2. Missing `display_name` returns `422 VALIDATION_ERROR`.
3. Whitespace-only `display_name` returns `422 VALIDATION_ERROR`.
4. `display_name` length `>64` returns `422 VALIDATION_ERROR`.
5. `display_name` containing control characters returns `422 VALIDATION_ERROR`.

### Integration Semantics
1. After successful create, `GET /api/session` (GM auth) returns `self.display_name` equal to submitted GM name.
2. Same snapshot includes GM in `players[]` with the submitted display name.
3. Existing create-session fields and status code remain unchanged (compatibility test).

## Parallelization Notes
- API can be implemented and merged independently once contract docs are updated.
- Frontend can proceed in parallel against this fixed payload contract (`display_name`) without waiting for API code freeze.
- Final cross-team check: one end-to-end host create from UI should produce snapshot `self.display_name` matching submitted GM name.

## Assumptions and Defaults
- Canonical field name is `display_name` (not `gm_name`).
- Validation limits are fixed at `session_name: 1..128` and `display_name: 1..64`.
- No response schema expansion is required for this feature.

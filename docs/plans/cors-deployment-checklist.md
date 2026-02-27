# CORS Deployment Checklist (Cross-Domain API)

Use this checklist when the frontend and API are on different origins, for example:
- App: `https://app.example.com`
- API: `https://api.example.com`

## 1. Define allowed origins per environment

- Production:
  - `https://app.example.com`
- Staging:
  - `https://staging-app.example.com`
- Development:
  - local app origin(s) only (for example `http://localhost:5173`)

Rules:
- Use exact origin matching (scheme + host + optional port).
- Do not use wildcard `*` for authenticated APIs.
- Do not reflect arbitrary request origins.

## 2. Handle CORS preflight (`OPTIONS`)

For API routes that receive `Authorization` and `Content-Type`, support preflight:

- Respond with `204 No Content`.
- Include:
  - `Access-Control-Allow-Origin: <allowed-origin>`
  - `Access-Control-Allow-Methods: GET,POST,OPTIONS`
  - `Access-Control-Allow-Headers: Authorization,Content-Type`
  - `Vary: Origin`

Optional hardening:
- `Access-Control-Max-Age` to reduce preflight frequency.

## 3. Include CORS headers on all response paths

Return CORS headers for:
- success responses,
- error envelope responses (`4xx`/`5xx`),
- auth failures (`401`/`403`),
- validation failures (`422`).

If missing on errors, browsers surface opaque CORS failures instead of contract error codes.

## 4. Keep auth model aligned with current contract

- Current contract uses `Authorization: Bearer <token>`.
- No cookie auth is required for v1.
- Do not set `Access-Control-Allow-Credentials` unless switching to cookie-based auth.

## 5. Frontend environment wiring

Set Vite env by deployment mode:

```env
VITE_API_BASE_URL=https://api.example.com/api
```

Client URL composition is centralized in:
- `src/lib/app-config.js`

## 6. Verify in browser + API logs

Before production sign-off:
- Confirm preflight `OPTIONS` returns `204` with expected CORS headers.
- Confirm `POST /api/join` succeeds from app origin with bearer auth.
- Confirm `GET /api/session` and `GET /api/events` succeed cross-origin.
- Confirm non-2xx responses still include CORS headers and JSON error envelope.
- Confirm disallowed origin requests are rejected without exposing API to unknown origins.

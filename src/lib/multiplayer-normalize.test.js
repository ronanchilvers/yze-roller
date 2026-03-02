import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { ApiClientError } from "./api-client.js";
import {
  buildAuthLostState,
  buildErrorBackoffIntervalMs,
  buildEventsPath,
  DEFAULT_POLL_INTERVAL_MS,
  extractNextSinceId,
  getGmContext,
  IDLE_BACKOFF_MULTIPLIER,
  INITIAL_MULTIPLAYER_SESSION_STATE,
  isAuthFailure,
  normalizeEventList,
  normalizeGmPlayers,
  normalizeNonNegativeInteger,
  requestEventsWithTimeout,
  scaleIdleInterval,
  validatePushPayload,
  validateRollPayload,
} from "./multiplayer-normalize.js";

test("normalizeNonNegativeInteger clamps invalid values to fallback", () => {
  assert.equal(normalizeNonNegativeInteger(8.9), 8);
  assert.equal(normalizeNonNegativeInteger(-1, 2), 2);
  assert.equal(normalizeNonNegativeInteger("abc", 3), 3);
});

test("normalizeEventList keeps only object-like items", () => {
  assert.deepEqual(normalizeEventList([{ id: 1 }, null, "x", { id: 2 }]), [
    { id: 1 },
    { id: 2 },
  ]);
});

test("normalizeGmPlayers excludes revoked and invalid players", () => {
  assert.deepEqual(
    normalizeGmPlayers([
      { token_id: 10, role: "player", display_name: " Alice " },
      { token_id: 11, role: "player", display_name: "Bob", revoked: true },
      { token_id: 12, role: "invalid", display_name: "Bad" },
    ]),
    [{ tokenId: 10, role: "player", displayName: "Alice" }],
  );
});

test("validate roll/push payloads reject malformed values", () => {
  assert.deepEqual(validateRollPayload({ successes: 1, banes: 0 }), {
    successes: 1,
    banes: 0,
  });
  assert.equal(validateRollPayload({ successes: 101, banes: 0 }), null);

  assert.deepEqual(validatePushPayload({ successes: 2, banes: 1, strain: true }), {
    successes: 2,
    banes: 1,
    strain: true,
  });
  assert.equal(validatePushPayload({ successes: 2, banes: 1, strain: 1 }), null);
});

test("isAuthFailure matches auth status and token error codes", () => {
  assert.equal(
    isAuthFailure(
      new ApiClientError({
        status: 401,
        code: "HTTP_401",
        message: "Unauthorized",
      }),
    ),
    true,
  );
  assert.equal(
    isAuthFailure(
      new ApiClientError({
        status: 500,
        code: "TOKEN_REVOKED",
        message: "Revoked",
      }),
    ),
    true,
  );
  assert.equal(
    isAuthFailure(
      new ApiClientError({
        status: 500,
        code: "SERVER_ERROR",
        message: "Bad",
      }),
    ),
    false,
  );
});

test("build path/backoff/cursor helpers behave deterministically", () => {
  assert.equal(buildEventsPath(12), "/events?since_id=12&limit=10");
  assert.equal(scaleIdleInterval(DEFAULT_POLL_INTERVAL_MS), Math.round(DEFAULT_POLL_INTERVAL_MS * IDLE_BACKOFF_MULTIPLIER));
  assert.equal(buildErrorBackoffIntervalMs(DEFAULT_POLL_INTERVAL_MS, 0), 800);
  assert.equal(
    extractNextSinceId(4, [{ id: 9 }], null),
    0,
  );
});

test("buildAuthLostState and getGmContext return guarded state", () => {
  const authError = new ApiClientError({
    status: 403,
    code: "TOKEN_INVALID",
    message: "Token invalid",
  });
  const state = buildAuthLostState(authError);
  assert.equal(state.status, "auth_lost");
  assert.equal(state.pollingStatus, "stopped");
  assert.equal(state.errorCode, "TOKEN_INVALID");

  assert.deepEqual(getGmContext({ sessionId: 7, role: "gm" }, "token"), {
    ok: true,
    sessionId: 7,
  });
  assert.equal(getGmContext({ sessionId: 7, role: "player" }, "token").ok, false);
  assert.equal(getGmContext({ sessionId: null, role: "gm" }, "token").ok, true);
});

test("requestEventsWithTimeout resolves and times out correctly", async () => {
  vi.useFakeTimers();

  const quickRequest = vi.fn(async () => ({ status: 204, data: null }));
  const quickResponse = await requestEventsWithTimeout("/events", "token", quickRequest);
  assert.equal(quickResponse.status, 204);

  const stalledRequest = vi.fn(
    () => new Promise(() => {}),
  );
  const timeoutErrorPromise = requestEventsWithTimeout(
    "/events",
    "token",
    stalledRequest,
  ).catch((error) => error);

  await vi.advanceTimersByTimeAsync(5001);

  const timeoutError = await timeoutErrorPromise;
  assert.equal(timeoutError.message, "Polling request timed out.");
  vi.useRealTimers();
});

test("initial multiplayer session state shape remains stable", () => {
  assert.equal(INITIAL_MULTIPLAYER_SESSION_STATE.status, "idle");
  assert.equal(INITIAL_MULTIPLAYER_SESSION_STATE.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS);
});

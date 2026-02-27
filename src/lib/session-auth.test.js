import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import {
  clearSessionAuth,
  getSessionAuth,
  setSessionAuth,
} from "./session-auth.js";

afterEach(() => {
  clearSessionAuth();
});

test("setSessionAuth stores normalized in-memory auth state", () => {
  const saved = setSessionAuth({
    sessionToken: "  token-abc  ",
    sessionId: 42.9,
    role: "player",
    self: {
      token_id: 31,
      display_name: "Alice",
      role: "player",
    },
  });

  assert.deepEqual(saved, {
    sessionToken: "token-abc",
    sessionId: 42,
    role: "player",
    self: {
      token_id: 31,
      display_name: "Alice",
      role: "player",
    },
  });
  assert.deepEqual(getSessionAuth(), saved);
});

test("setSessionAuth clears state when token is missing", () => {
  setSessionAuth({
    sessionToken: "valid-token",
    sessionId: 2,
  });
  assert.notEqual(getSessionAuth(), null);

  const cleared = setSessionAuth({
    sessionToken: "   ",
    sessionId: 2,
  });

  assert.equal(cleared, null);
  assert.equal(getSessionAuth(), null);
});

test("clearSessionAuth removes stored state", () => {
  setSessionAuth({
    sessionToken: "persisted-token",
    sessionId: 5,
  });

  clearSessionAuth();
  assert.equal(getSessionAuth(), null);
});

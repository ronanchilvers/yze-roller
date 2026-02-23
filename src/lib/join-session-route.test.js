import assert from "node:assert/strict";
import { test, vi } from "vitest";
import {
  clearLocationHash,
  getSessionPathFromJoinPath,
  isJoinSessionPath,
  normalizePathname,
  parseJoinTokenFromHash,
} from "./join-session-route.js";

test("normalizePathname trims trailing slashes with root fallback", () => {
  assert.equal(normalizePathname("/join/"), "/join");
  assert.equal(normalizePathname("/"), "/");
  assert.equal(normalizePathname("   "), "/");
});

test("isJoinSessionPath matches join route suffix", () => {
  assert.equal(isJoinSessionPath("/join"), true);
  assert.equal(isJoinSessionPath("/yze-roller/join/"), true);
  assert.equal(isJoinSessionPath("/session"), false);
});

test("parseJoinTokenFromHash reads #join token values", () => {
  assert.equal(parseJoinTokenFromHash("#join=abc123"), "abc123");
  assert.equal(parseJoinTokenFromHash("#foo=1&join=hello"), "hello");
  assert.equal(parseJoinTokenFromHash("#join="), null);
  assert.equal(parseJoinTokenFromHash("#foo=bar"), null);
});

test("getSessionPathFromJoinPath removes trailing join segment", () => {
  assert.equal(getSessionPathFromJoinPath("/join"), "/");
  assert.equal(getSessionPathFromJoinPath("/yze-roller/join"), "/yze-roller");
  assert.equal(getSessionPathFromJoinPath("/yze-roller/session"), "/yze-roller/session");
});

test("clearLocationHash uses history.replaceState when available", () => {
  const replaceState = vi.fn();

  clearLocationHash({
    location: {
      pathname: "/join",
      search: "?foo=1",
      hash: "#join=abc",
    },
    history: {
      replaceState,
    },
  });

  assert.equal(replaceState.mock.calls.length, 1);
  assert.deepEqual(replaceState.mock.calls[0], [{}, "", "/join?foo=1"]);
});

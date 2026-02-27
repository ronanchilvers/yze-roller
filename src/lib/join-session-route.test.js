import assert from "node:assert/strict";
import { test, vi } from "vitest";
import {
  buildJoinPathWithToken,
  clearLocationHash,
  getSessionPathFromJoinPath,
  isJoinSessionPath,
  normalizePathname,
  parseJoinTokenFromHash,
  parseJoinTokenFromInviteInput,
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

test("parseJoinTokenFromInviteInput resolves token from hash links and raw tokens", () => {
  assert.equal(
    parseJoinTokenFromInviteInput("https://app.example.com/join#join=abc123"),
    "abc123",
  );
  assert.equal(parseJoinTokenFromInviteInput("#join=hello"), "hello");
  assert.equal(parseJoinTokenFromInviteInput(" raw-token "), "raw-token");
});

test("parseJoinTokenFromInviteInput returns null for invalid invite input", () => {
  assert.equal(
    parseJoinTokenFromInviteInput("https://app.example.com/join"),
    null,
  );
  assert.equal(parseJoinTokenFromInviteInput(""), null);
  assert.equal(parseJoinTokenFromInviteInput("not a token"), null);
});

test("getSessionPathFromJoinPath removes trailing join segment", () => {
  assert.equal(getSessionPathFromJoinPath("/join"), "/");
  assert.equal(getSessionPathFromJoinPath("/yze-roller/join"), "/yze-roller");
  assert.equal(getSessionPathFromJoinPath("/yze-roller/session"), "/yze-roller/session");
});

test("buildJoinPathWithToken composes join route with encoded token", () => {
  assert.equal(buildJoinPathWithToken("/", "abc123"), "/join#join=abc123");
  assert.equal(
    buildJoinPathWithToken("/yze-roller", "a b"),
    "/yze-roller/join#join=a%20b",
  );
  assert.equal(buildJoinPathWithToken("/join", "abc123"), "/join#join=abc123");
  assert.equal(buildJoinPathWithToken("/", ""), null);
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

import assert from "node:assert/strict";
import { test } from "vitest";
import {
  API_BASE_URL_ENV_KEY,
  DEFAULT_API_BASE_URL,
  buildApiUrl,
  getApiBaseUrl,
  normalizeApiBaseUrl,
} from "./app-config.js";

test("getApiBaseUrl falls back to default when env key is missing", () => {
  assert.equal(getApiBaseUrl({}), DEFAULT_API_BASE_URL);
});

test("normalizeApiBaseUrl trims whitespace and trailing slashes", () => {
  assert.equal(
    normalizeApiBaseUrl(" https://api.example.com/ "),
    "https://api.example.com",
  );
  assert.equal(normalizeApiBaseUrl("/api/"), "/api");
});

test("normalizeApiBaseUrl allows root slash", () => {
  assert.equal(normalizeApiBaseUrl("/"), "/");
});

test("getApiBaseUrl throws when env value is empty", () => {
  assert.throws(
    () => getApiBaseUrl({ [API_BASE_URL_ENV_KEY]: "   " }),
    /must not be empty/,
  );
});

test("buildApiUrl prepends leading slash to request paths", () => {
  const env = { [API_BASE_URL_ENV_KEY]: "https://api.example.com/v1/" };

  assert.equal(
    buildApiUrl("events?since_id=10", env),
    "https://api.example.com/v1/events?since_id=10",
  );
});

test("buildApiUrl uses default base when env key is missing", () => {
  assert.equal(buildApiUrl("/session", {}), "/api/session");
});

test("buildApiUrl throws when path is empty", () => {
  assert.throws(() => buildApiUrl("  ", {}), /must not be empty/);
});

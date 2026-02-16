import assert from "node:assert/strict";
import { test } from "vitest";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_PREFERENCE_STORAGE_KEY,
  loadThemePreference,
  saveThemePreference,
} from "./theme-preference.js";

const createMemoryStorage = () => {
  const entries = new Map();

  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
  };
};

test("loadThemePreference uses fallback defaults when storage is unavailable", () => {
  assert.equal(loadThemePreference(null), DEFAULT_THEME_PREFERENCE);
});

test("saveThemePreference writes sanitized values and loadThemePreference reads them", () => {
  const storage = createMemoryStorage();

  assert.equal(saveThemePreference(storage, "dark"), true);
  assert.equal(loadThemePreference(storage), "dark");
});

test("loadThemePreference handles malformed JSON safely", () => {
  const storage = createMemoryStorage();
  storage.setItem(THEME_PREFERENCE_STORAGE_KEY, "{broken");

  assert.equal(loadThemePreference(storage), DEFAULT_THEME_PREFERENCE);
});

test("saveThemePreference returns false when storage write throws", () => {
  const brokenStorage = {
    setItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(
    saveThemePreference(brokenStorage, DEFAULT_THEME_PREFERENCE),
    false,
  );
});

test("loadThemePreference rejects oversized localStorage values", () => {
  const storage = createMemoryStorage();
  const oversizedPayload = JSON.stringify({
    preference: "dark",
    maliciousData: "x".repeat(800),
  });

  storage.setItem(THEME_PREFERENCE_STORAGE_KEY, oversizedPayload);

  assert.equal(loadThemePreference(storage), DEFAULT_THEME_PREFERENCE);
});

test("loadThemePreference rejects unknown preferences", () => {
  const storage = createMemoryStorage();
  storage.setItem(
    THEME_PREFERENCE_STORAGE_KEY,
    JSON.stringify({
      preference: "blue-neon",
      unexpectedField: true,
    }),
  );

  assert.equal(loadThemePreference(storage), DEFAULT_THEME_PREFERENCE);
});

test("loadThemePreference supports legacy serialized string format", () => {
  const storage = createMemoryStorage();
  storage.setItem(THEME_PREFERENCE_STORAGE_KEY, JSON.stringify("light"));

  assert.equal(loadThemePreference(storage), "light");
});

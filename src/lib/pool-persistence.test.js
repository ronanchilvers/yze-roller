import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POOL_SELECTION,
  POOL_STORAGE_KEY,
  loadPoolSelection,
  savePoolSelection,
} from "./pool-persistence.js";

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

test("loadPoolSelection uses fallback defaults when storage is unavailable", () => {
  assert.deepEqual(loadPoolSelection(null), DEFAULT_POOL_SELECTION);
});

test("savePoolSelection writes sanitized values and loadPoolSelection reads them", () => {
  const storage = createMemoryStorage();

  assert.equal(
    savePoolSelection(storage, {
      attributeDice: "0",
      skillDice: "4",
    }),
    true,
  );

  assert.deepEqual(loadPoolSelection(storage), {
    attributeDice: 1,
    skillDice: 4,
  });
});

test("loadPoolSelection handles malformed JSON safely", () => {
  const storage = createMemoryStorage();
  storage.setItem(POOL_STORAGE_KEY, "{nope");

  assert.deepEqual(loadPoolSelection(storage), DEFAULT_POOL_SELECTION);
});

test("savePoolSelection returns false when storage write throws", () => {
  const brokenStorage = {
    setItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(savePoolSelection(brokenStorage, DEFAULT_POOL_SELECTION), false);
});

test("loadPoolSelection rejects oversized localStorage values", () => {
  const storage = createMemoryStorage();
  // Create a payload exceeding 1 KB size limit
  const oversizedPayload = JSON.stringify({
    attributeDice: 3,
    skillDice: 1,
    maliciousData: "x".repeat(2000), // Exceeds 1 KB limit
  });

  storage.setItem(POOL_STORAGE_KEY, oversizedPayload);

  // Should fall back to defaults when size limit is exceeded
  assert.deepEqual(loadPoolSelection(storage), DEFAULT_POOL_SELECTION);
});

test("loadPoolSelection strips unknown/injected fields after save → load", () => {
  const storage = createMemoryStorage();

  // Manually inject a payload with extra fields
  const maliciousPayload = JSON.stringify({
    attributeDice: 5,
    skillDice: 2,
    __proto__: { polluted: true },
    constructor: { name: "FakeConstructor" },
    unexpectedField: "should be stripped",
    nested: { deep: { structure: "not allowed" } },
  });

  storage.setItem(POOL_STORAGE_KEY, maliciousPayload);

  const loaded = loadPoolSelection(storage);

  // Only allowlisted fields should be present
  assert.deepEqual(loaded, {
    attributeDice: 5,
    skillDice: 2,
  });

  // Verify no prototype pollution occurred
  assert.equal(Object.prototype.polluted, undefined);
  assert.notEqual(loaded.constructor.name, "FakeConstructor");

  // Verify unknown fields were stripped
  assert.equal(loaded.unexpectedField, undefined);
  assert.equal(loaded.nested, undefined);
  assert.equal(loaded.__proto__, Object.prototype); // Should be normal prototype
});

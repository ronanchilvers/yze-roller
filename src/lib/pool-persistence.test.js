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

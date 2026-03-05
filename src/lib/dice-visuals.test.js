import assert from "node:assert/strict";
import { test } from "vitest";
import { DICE_TYPE } from "./dice.js";
import { getDieColor } from "./dice-visuals.js";

test("getDieColor resolves known and fallback types", () => {
  assert.equal(getDieColor(DICE_TYPE.ATTRIBUTE), "#55aa5f");
  assert.equal(getDieColor(DICE_TYPE.KEY_ATTRIBUTE), "#185922");
  assert.equal(getDieColor(DICE_TYPE.SKILL), "#e1c74b");
  assert.equal(getDieColor(DICE_TYPE.STRAIN), "#d15c5c");
  assert.equal(getDieColor(DICE_TYPE.MODIFIER), "#7a4cc9");
  assert.equal(getDieColor("unknown"), "#55aa5f");
});

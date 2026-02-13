import assert from "node:assert/strict";
import test from "node:test";
import { DICE_TYPE } from "./dice.js";
import { getDieColor } from "./dice-visuals.js";

test("getDieColor resolves known and fallback types", () => {
  assert.equal(getDieColor(DICE_TYPE.ATTRIBUTE), "#55aa5f");
  assert.equal(getDieColor(DICE_TYPE.SKILL), "#e1c74b");
  assert.equal(getDieColor(DICE_TYPE.STRAIN), "#d15c5c");
  assert.equal(getDieColor("unknown"), "#55aa5f");
});

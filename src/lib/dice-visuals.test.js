import assert from "node:assert/strict";
import test from "node:test";
import { DICE_TYPE } from "./dice.js";
import { getDieColor, selectAnimatedDiceIds } from "./dice-visuals.js";

test("selectAnimatedDiceIds animates all dice on roll actions", () => {
  assert.deepEqual(
    selectAnimatedDiceIds({
      action: "roll",
      dice: [
        { id: "a-1", wasPushed: false },
        { id: "s-1", wasPushed: false },
      ],
    }),
    ["a-1", "s-1"],
  );
});

test("selectAnimatedDiceIds animates only pushed dice on push actions", () => {
  assert.deepEqual(
    selectAnimatedDiceIds({
      action: "push",
      dice: [
        { id: "a-1", wasPushed: false },
        { id: "s-1", wasPushed: true },
        { id: "t-1", wasPushed: false },
      ],
    }),
    ["s-1"],
  );
});

test("getDieColor resolves known and fallback types", () => {
  assert.equal(getDieColor(DICE_TYPE.ATTRIBUTE), "#55aa5f");
  assert.equal(getDieColor(DICE_TYPE.SKILL), "#e1c74b");
  assert.equal(getDieColor(DICE_TYPE.STRAIN), "#d15c5c");
  assert.equal(getDieColor("unknown"), "#55aa5f");
});

import assert from "node:assert/strict";
import { test } from "vitest";
import {
  applyRollModifierToCounts,
  MAX_ROLL_MODIFIER,
  MIN_ROLL_MODIFIER,
  normalizeRollModifier,
} from "./roll-modifier.js";

test("normalizeRollModifier clamps values to the supported range", () => {
  assert.equal(normalizeRollModifier(-99), MIN_ROLL_MODIFIER);
  assert.equal(normalizeRollModifier(99), MAX_ROLL_MODIFIER);
  assert.equal(normalizeRollModifier("2"), 2);
  assert.equal(normalizeRollModifier("bad"), 0);
});

test("positive modifier adds modifier dice without changing base dice", () => {
  assert.deepEqual(
    applyRollModifierToCounts(
      {
        attributeDice: 3,
        keyAttributeDice: 0,
        skillDice: 2,
        strainDice: 4,
      },
      2,
    ),
    {
      attributeDice: 3,
      keyAttributeDice: 0,
      skillDice: 2,
      strainDice: 4,
      modifierDice: 2,
    },
  );
});

test("negative modifier removes skill dice before attribute dice", () => {
  assert.deepEqual(
    applyRollModifierToCounts(
      {
        attributeDice: 4,
        keyAttributeDice: 0,
        skillDice: 2,
        strainDice: 3,
      },
      -3,
    ),
    {
      attributeDice: 3,
      keyAttributeDice: 0,
      skillDice: 0,
      strainDice: 3,
      modifierDice: 0,
    },
  );
});

test("negative modifier never removes strain dice", () => {
  assert.deepEqual(
    applyRollModifierToCounts(
      {
        attributeDice: 2,
        keyAttributeDice: 0,
        skillDice: 0,
        strainDice: 5,
      },
      -3,
    ),
    {
      attributeDice: 1,
      keyAttributeDice: 0,
      skillDice: 0,
      strainDice: 5,
      modifierDice: 0,
    },
  );
});

test("negative modifier never reduces pool below one attribute die", () => {
  assert.deepEqual(
    applyRollModifierToCounts(
      {
        attributeDice: 1,
        keyAttributeDice: 0,
        skillDice: 0,
        strainDice: 999,
      },
      -3,
    ),
    {
      attributeDice: 1,
      keyAttributeDice: 0,
      skillDice: 0,
      strainDice: 999,
      modifierDice: 0,
    },
  );
});

test("positive modifier preserves key attribute die", () => {
  assert.deepEqual(
    applyRollModifierToCounts(
      {
        attributeDice: 2,
        keyAttributeDice: 1,
        skillDice: 1,
        strainDice: 0,
      },
      2,
    ),
    {
      attributeDice: 2,
      keyAttributeDice: 1,
      skillDice: 1,
      strainDice: 0,
      modifierDice: 2,
    },
  );
});

test("negative modifier removes regular attribute dice before key attribute dice", () => {
  assert.deepEqual(
    applyRollModifierToCounts(
      {
        attributeDice: 2,
        keyAttributeDice: 1,
        skillDice: 0,
        strainDice: 0,
      },
      -3,
    ),
    {
      attributeDice: 0,
      keyAttributeDice: 1,
      skillDice: 0,
      strainDice: 0,
      modifierDice: 0,
    },
  );
});

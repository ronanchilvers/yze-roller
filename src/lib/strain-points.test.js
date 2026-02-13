import assert from "node:assert/strict";
import test from "node:test";
import { DICE_TYPE, rollPool } from "./dice.js";
import {
  buildCountsWithStrain,
  calculateBaneIncrease,
  incrementStrainPointsByBanes,
  normalizeStrainPoints,
} from "./strain-points.js";

const createSequenceRng = (samples) => {
  let index = 0;

  return () => {
    const sample = samples[index];
    index = Math.min(index + 1, samples.length);
    return sample;
  };
};

test("normalizeStrainPoints enforces non-negative integers", () => {
  assert.equal(normalizeStrainPoints(-1), 0);
  assert.equal(normalizeStrainPoints("3"), 3);
  assert.equal(normalizeStrainPoints("bad"), 0);
});

test("incrementStrainPointsByBanes adds total banes from pushed result", () => {
  assert.equal(
    incrementStrainPointsByBanes(2, {
      outcomes: { banes: 3 },
    }),
    5,
  );
});

test("incrementStrainPointsByBanes handles malformed input without throwing", () => {
  assert.doesNotThrow(() => incrementStrainPointsByBanes("bad", null));
  assert.equal(incrementStrainPointsByBanes("bad", null), 0);
});

test("buildCountsWithStrain includes current strain as strain dice", () => {
  assert.deepEqual(
    buildCountsWithStrain(
      {
        attributeDice: 2,
        skillDice: 1,
      },
      4,
    ),
    {
      attributeDice: 2,
      skillDice: 1,
      strainDice: 4,
    },
  );
});

test("strain accumulation is reflected in subsequent roll strain dice", () => {
  const strainAfterPush = incrementStrainPointsByBanes(1, {
    outcomes: { banes: 2 },
  });
  const nextCounts = buildCountsWithStrain(
    {
      attributeDice: 1,
      skillDice: 0,
    },
    strainAfterPush,
  );
  const nextRoll = rollPool(nextCounts, createSequenceRng([0, 0.2, 0.4, 0.6]));

  assert.equal(strainAfterPush, 3);
  assert.equal(
    nextRoll.dice.filter((die) => die.type === DICE_TYPE.STRAIN).length,
    3,
  );
});

test("calculateBaneIncrease returns all banes on first push", () => {
  const previousRoll = { outcomes: { banes: 0 } };
  const nextRoll = { outcomes: { banes: 3 } };

  assert.equal(calculateBaneIncrease(previousRoll, nextRoll, true), 3);
});

test("calculateBaneIncrease returns only new banes on subsequent pushes", () => {
  const previousRoll = { outcomes: { banes: 2 } };
  const nextRoll = { outcomes: { banes: 4 } };

  assert.equal(calculateBaneIncrease(previousRoll, nextRoll, false), 2);
});

test("calculateBaneIncrease returns zero when banes decrease", () => {
  const previousRoll = { outcomes: { banes: 5 } };
  const nextRoll = { outcomes: { banes: 2 } };

  assert.equal(calculateBaneIncrease(previousRoll, nextRoll, false), 0);
});

test("calculateBaneIncrease handles missing outcomes gracefully", () => {
  assert.equal(calculateBaneIncrease(null, { outcomes: { banes: 2 } }, true), 2);
  assert.equal(calculateBaneIncrease({ outcomes: {} }, { outcomes: { banes: 3 } }, true), 3);
});

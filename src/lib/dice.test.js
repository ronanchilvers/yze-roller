import assert from "node:assert/strict";
import test from "node:test";
import {
  DICE_TYPE,
  buildDicePool,
  classifyFace,
  countOutcomes,
  isPushableFace,
  normalizeDiceCount,
  pushDice,
  sanitizePoolCounts,
} from "./dice.js";

const createSequenceRng = (samples) => {
  let index = 0;

  return () => {
    const sample = samples[index];
    index = Math.min(index + 1, samples.length);
    return sample;
  };
};

test("normalizeDiceCount enforces bounds and handles malformed input", () => {
  assert.equal(
    normalizeDiceCount("9", { min: 1, max: 20, fallback: 1 }),
    9,
  );
  assert.equal(
    normalizeDiceCount("-5", { min: 1, max: 20, fallback: 1 }),
    1,
  );
  assert.equal(
    normalizeDiceCount("abc", { min: 0, max: 20, fallback: 0 }),
    0,
  );
  assert.equal(
    normalizeDiceCount(999, { min: 0, max: 20, fallback: 0 }),
    20,
  );
});

test("sanitizePoolCounts guards invalid structures with safe defaults", () => {
  assert.deepEqual(sanitizePoolCounts(null), {
    attributeDice: 1,
    skillDice: 0,
    strainDice: 0,
  });

  assert.deepEqual(
    sanitizePoolCounts({
      attributeDice: "0",
      skillDice: "-1",
      strainDice: "bogus",
    }),
    {
      attributeDice: 1,
      skillDice: 0,
      strainDice: 0,
    },
  );
});

test("classifyFace maps 6 to success and 1 to bane", () => {
  assert.deepEqual(classifyFace(6), { face: 6, success: true, bane: false });
  assert.deepEqual(classifyFace(1), { face: 1, success: false, bane: true });
  assert.deepEqual(classifyFace("bad"), {
    face: null,
    success: false,
    bane: false,
  });
});

test("isPushableFace only permits faces 2-5", () => {
  assert.equal(isPushableFace(1), false);
  assert.equal(isPushableFace(2), true);
  assert.equal(isPushableFace(5), true);
  assert.equal(isPushableFace(6), false);
  assert.equal(isPushableFace("x"), false);
});

test("pushDice rerolls only pushable faces", () => {
  const rng = createSequenceRng([0.99, 0]); // 6 then 1
  const pushed = pushDice(
    [
      { id: "a-1", type: DICE_TYPE.ATTRIBUTE, face: 1 },
      { id: "a-2", type: DICE_TYPE.ATTRIBUTE, face: 2 },
      { id: "s-1", type: DICE_TYPE.SKILL, face: 5 },
      { id: "t-1", type: DICE_TYPE.STRAIN, face: 6 },
    ],
    rng,
  );

  assert.deepEqual(
    pushed.map((die) => [die.id, die.face, die.wasPushed]),
    [
      ["a-1", 1, false],
      ["a-2", 6, true],
      ["s-1", 1, true],
      ["t-1", 6, false],
    ],
  );
});

test("countOutcomes totals successes/banes and detects strain", () => {
  assert.deepEqual(
    countOutcomes([
      { type: DICE_TYPE.ATTRIBUTE, face: 6 },
      { type: DICE_TYPE.SKILL, face: 1 },
      { type: DICE_TYPE.STRAIN, face: 1 },
      { type: DICE_TYPE.STRAIN, face: null },
    ]),
    {
      successes: 1,
      banes: 2,
      hasStrain: true,
    },
  );
});

test("buildDicePool creates expected number of typed dice", () => {
  const pool = buildDicePool({
    attributeDice: 2,
    skillDice: 1,
    strainDice: 3,
  });

  assert.equal(pool.length, 6);
  assert.equal(pool.filter((die) => die.type === DICE_TYPE.ATTRIBUTE).length, 2);
  assert.equal(pool.filter((die) => die.type === DICE_TYPE.SKILL).length, 1);
  assert.equal(pool.filter((die) => die.type === DICE_TYPE.STRAIN).length, 3);
});

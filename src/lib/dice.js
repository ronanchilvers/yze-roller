import { cryptoRandom } from "./secure-random.js";

export const MAX_DICE = 20;
export const MAX_STRAIN_DICE = 999;
export const DICE_TYPE = Object.freeze({
  ATTRIBUTE: "attribute",
  SKILL: "skill",
  STRAIN: "strain",
});
export const EMPTY_OUTCOME = Object.freeze({
  successes: 0,
  banes: 0,
  hasStrain: false,
});

/** Normalization options for attribute dice (min 1, max MAX_DICE, fallback 1). */
export const ATTRIBUTE_DICE_OPTS = Object.freeze({
  min: 1,
  max: MAX_DICE,
  fallback: 1,
});

/** Normalization options for skill dice (min 0, max MAX_DICE, fallback 0). */
export const SKILL_DICE_OPTS = Object.freeze({
  min: 0,
  max: MAX_DICE,
  fallback: 0,
});

/** Normalization options for strain dice (min 0, max MAX_STRAIN_DICE, fallback 0). */
export const STRAIN_DICE_OPTS = Object.freeze({
  min: 0,
  max: MAX_STRAIN_DICE,
  fallback: 0,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toSafeInteger = (value, fallback) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.trunc(parsed);
};

export const normalizeDiceCount = (value, options = {}) => {
  const configuredMin = toSafeInteger(options.min, 0);
  const configuredMax = toSafeInteger(options.max, MAX_DICE);
  const low = Math.min(configuredMin, configuredMax);
  const high = Math.max(configuredMin, configuredMax);
  const configuredFallback = toSafeInteger(options.fallback, low);
  const fallback = clamp(configuredFallback, low, high);
  const parsed = toSafeInteger(value, fallback);

  return clamp(parsed, low, high);
};

export const sanitizePoolCounts = (counts) => {
  const source = counts && typeof counts === "object" ? counts : {};

  return {
    attributeDice: normalizeDiceCount(
      source.attributeDice,
      ATTRIBUTE_DICE_OPTS,
    ),
    skillDice: normalizeDiceCount(source.skillDice, SKILL_DICE_OPTS),
    strainDice: normalizeDiceCount(source.strainDice, STRAIN_DICE_OPTS),
  };
};

/**
 * Generates a stable ID for a die, using its existing ID or creating one from the index.
 *
 * @param {object} die - The die object (may have an id property)
 * @param {number} index - The die's position in the array (0-based)
 * @returns {string} A stable string ID for the die
 */
export const getDieId = (die, index) => {
  return String(die?.id ?? `die-${index + 1}`);
};

const normalizeDieType = (value) => {
  if (value === DICE_TYPE.SKILL || value === DICE_TYPE.STRAIN) {
    return value;
  }

  return DICE_TYPE.ATTRIBUTE;
};

const normalizeDie = (die, index) => {
  const source = die && typeof die === "object" ? die : {};
  const face = Number(source.face);

  return {
    id: getDieId(source, index),
    type: normalizeDieType(source.type),
    face: Number.isInteger(face) ? face : null,
  };
};

export const normalizeDicePool = (dicePool) => {
  if (!Array.isArray(dicePool)) {
    return [];
  }

  return dicePool.map((die, index) => normalizeDie(die, index));
};

export const buildDicePool = (counts) => {
  const normalized = sanitizePoolCounts(counts);
  const pool = [];

  for (let index = 0; index < normalized.attributeDice; index += 1) {
    pool.push({
      id: `attribute-${index + 1}`,
      type: DICE_TYPE.ATTRIBUTE,
      face: null,
    });
  }

  for (let index = 0; index < normalized.skillDice; index += 1) {
    pool.push({ id: `skill-${index + 1}`, type: DICE_TYPE.SKILL, face: null });
  }

  for (let index = 0; index < normalized.strainDice; index += 1) {
    pool.push({
      id: `strain-${index + 1}`,
      type: DICE_TYPE.STRAIN,
      face: null,
    });
  }

  return pool;
};

export const classifyFace = (faceValue) => {
  const face = Number(faceValue);

  if (!Number.isInteger(face)) {
    return { face: null, success: false, bane: false };
  }

  return {
    face,
    success: face === 6,
    bane: face === 1,
  };
};

export const isPushableFace = (faceValue) => {
  const face = Number(faceValue);
  return Number.isInteger(face) && face > 1 && face < 6;
};

export const rollD6 = (randomSource = cryptoRandom) => {
  if (typeof randomSource !== "function") {
    return 1;
  }

  const sample = Number(randomSource());

  if (!Number.isFinite(sample)) {
    return 1;
  }

  const normalized = clamp(sample, 0, 0.999999999);
  return Math.floor(normalized * 6) + 1;
};

export const rollDice = (dicePool, randomSource = cryptoRandom) => {
  return normalizeDicePool(dicePool).map((die) => ({
    ...die,
    face: rollD6(randomSource),
    wasPushed: false,
  }));
};

export const getPushableDiceIds = (dicePool) => {
  return normalizeDicePool(dicePool)
    .filter((die) => isPushableFace(die.face))
    .map((die) => die.id);
};

export const pushDice = (dicePool, randomSource = cryptoRandom) => {
  return normalizeDicePool(dicePool).map((die) => {
    if (!isPushableFace(die.face)) {
      return { ...die, wasPushed: false };
    }

    return { ...die, face: rollD6(randomSource), wasPushed: true };
  });
};

export const aggregateDiceById = (originalDice, updates) => {
  const normalizedOriginal = normalizeDicePool(originalDice);
  const normalizedUpdates = normalizeDicePool(updates);
  const updateById = new Map(normalizedUpdates.map((die) => [die.id, die]));
  const merged = normalizedOriginal.map((die) => updateById.get(die.id) ?? die);
  const originalIds = new Set(normalizedOriginal.map((die) => die.id));

  for (const update of normalizedUpdates) {
    if (!originalIds.has(update.id)) {
      merged.push(update);
    }
  }

  return merged;
};

export const countOutcomes = (dicePool) => {
  return normalizeDicePool(dicePool).reduce(
    (summary, die, index) => {
      const normalizedDie = normalizeDie(die, index);
      const classified = classifyFace(normalizedDie.face);

      if (classified.success) {
        summary.successes += 1;
      }

      if (classified.bane) {
        summary.banes += 1;
      }

      if (classified.bane && normalizedDie.type === DICE_TYPE.STRAIN) {
        summary.hasStrain = true;
      }

      return summary;
    },
    { ...EMPTY_OUTCOME },
  );
};

export const summarizeRoll = (dicePool) => {
  const dice = normalizeDicePool(dicePool);
  const pushableDiceIds = getPushableDiceIds(dice);

  return {
    dice,
    outcomes: countOutcomes(dice),
    pushableDiceIds,
    canPush: pushableDiceIds.length > 0,
  };
};

/**
 * Headless convenience wrapper: builds a pool from counts, rolls all dice,
 * and returns a summarized result. Not used by the visual 3D tray (which
 * resolves faces via physics simulation), but serves as the public API
 * for non-visual / integration testing (e.g. strain accumulation tests).
 *
 * @param {{ attributeDice?: number, skillDice?: number, strainDice?: number }} counts
 * @param {() => number} [randomSource=cryptoRandom]
 * @returns {{ dice: object[], outcomes: object, pushableDiceIds: string[], canPush: boolean }}
 */
export const rollPool = (counts, randomSource = cryptoRandom) => {
  const pool = buildDicePool(counts);
  const rolledDice = rollDice(pool, randomSource);
  return summarizeRoll(rolledDice);
};

/**
 * Headless convenience wrapper: takes an already-rolled dice pool, pushes
 * eligible dice, and returns a summarized result. Like {@link rollPool},
 * this is not used by the visual 3D tray but provides a composable API
 * for integration tests that need deterministic push outcomes.
 *
 * @param {object[]} dicePool - Array of dice objects with face values
 * @param {() => number} [randomSource=cryptoRandom]
 * @returns {{ dice: object[], outcomes: object, pushableDiceIds: string[], canPush: boolean }}
 */
export const pushPool = (dicePool, randomSource = cryptoRandom) => {
  const initialRoll = summarizeRoll(dicePool);
  const pushCandidates = initialRoll.dice.filter((die) =>
    isPushableFace(die.face),
  );
  const pushedCandidates = pushDice(pushCandidates, randomSource);
  const merged = aggregateDiceById(initialRoll.dice, pushedCandidates);
  return summarizeRoll(merged);
};

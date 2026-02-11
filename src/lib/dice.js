export const MAX_DICE = 20;
export const DICE_TYPE = Object.freeze({
  ATTRIBUTE: "attribute",
  SKILL: "skill",
  STRAIN: "strain",
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
    attributeDice: normalizeDiceCount(source.attributeDice, {
      min: 1,
      max: MAX_DICE,
      fallback: 1,
    }),
    skillDice: normalizeDiceCount(source.skillDice, {
      min: 0,
      max: MAX_DICE,
      fallback: 0,
    }),
    strainDice: normalizeDiceCount(source.strainDice, {
      min: 0,
      max: MAX_DICE,
      fallback: 0,
    }),
  };
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
    id: source.id ? String(source.id) : `die-${index + 1}`,
    type: normalizeDieType(source.type),
    face: Number.isInteger(face) ? face : null,
  };
};

export const buildDicePool = (counts) => {
  const normalized = sanitizePoolCounts(counts);
  const pool = [];

  for (let index = 0; index < normalized.attributeDice; index += 1) {
    pool.push({ id: `attribute-${index + 1}`, type: DICE_TYPE.ATTRIBUTE, face: null });
  }

  for (let index = 0; index < normalized.skillDice; index += 1) {
    pool.push({ id: `skill-${index + 1}`, type: DICE_TYPE.SKILL, face: null });
  }

  for (let index = 0; index < normalized.strainDice; index += 1) {
    pool.push({ id: `strain-${index + 1}`, type: DICE_TYPE.STRAIN, face: null });
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

export const rollD6 = (randomSource = Math.random) => {
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

export const pushDice = (dicePool, randomSource = Math.random) => {
  if (!Array.isArray(dicePool)) {
    return [];
  }

  return dicePool.map((die, index) => {
    const normalizedDie = normalizeDie(die, index);

    if (isPushableFace(normalizedDie.face)) {
      return { ...normalizedDie, face: rollD6(randomSource), wasPushed: true };
    }

    if (normalizedDie.face === null) {
      return { ...normalizedDie, face: rollD6(randomSource), wasPushed: true };
    }

    return { ...normalizedDie, wasPushed: false };
  });
};

export const countOutcomes = (dicePool) => {
  if (!Array.isArray(dicePool)) {
    return { successes: 0, banes: 0, hasStrain: false };
  }

  return dicePool.reduce(
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
    { successes: 0, banes: 0, hasStrain: false },
  );
};

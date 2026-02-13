import { MAX_STRAIN_DICE, normalizeDiceCount } from "./dice.js";

export const normalizeStrainPoints = (value) => {
  return normalizeDiceCount(value, {
    min: 0,
    max: MAX_STRAIN_DICE,
    fallback: 0,
  });
};

export const incrementStrainPointsByBanes = (
  currentStrainPoints,
  rollSummary,
) => {
  const current = normalizeStrainPoints(currentStrainPoints);
  const source =
    rollSummary && typeof rollSummary === "object" ? rollSummary : {};
  const outcomes =
    source.outcomes && typeof source.outcomes === "object"
      ? source.outcomes
      : {};
  const banes = normalizeDiceCount(outcomes.banes, {
    min: 0,
    max: MAX_STRAIN_DICE,
    fallback: 0,
  });

  return normalizeStrainPoints(current + banes);
};

export const buildCountsWithStrain = (selection, strainPoints) => {
  const source = selection && typeof selection === "object" ? selection : {};

  return {
    attributeDice: source.attributeDice,
    skillDice: source.skillDice,
    strainDice: normalizeStrainPoints(strainPoints),
  };
};

/**
 * Calculates how many banes should be added to strain points after a push.
 * On the first push of a roll, all banes count. On subsequent pushes, only new banes count.
 *
 * @param {object} previousRoll - The roll state before pushing
 * @param {object} nextRoll - The roll state after pushing
 * @param {boolean} isFirstPush - Whether this is the first push of the current roll
 * @returns {number} The number of banes to add to strain points
 */
export const calculateBaneIncrease = (previousRoll, nextRoll, isFirstPush) => {
  const previousBanes = Number(previousRoll?.outcomes?.banes ?? 0);
  const currentBanes = Number(nextRoll?.outcomes?.banes ?? 0);

  if (isFirstPush) {
    return Math.max(0, currentBanes);
  }

  return Math.max(0, currentBanes - previousBanes);
};

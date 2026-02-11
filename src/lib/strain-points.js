import { MAX_STRAIN_DICE, normalizeDiceCount } from "./dice.js";

export const normalizeStrainPoints = (value) => {
  return normalizeDiceCount(value, {
    min: 0,
    max: MAX_STRAIN_DICE,
    fallback: 0,
  });
};

export const incrementStrainPointsByBanes = (currentStrainPoints, rollSummary) => {
  const current = normalizeStrainPoints(currentStrainPoints);
  const source = rollSummary && typeof rollSummary === "object" ? rollSummary : {};
  const outcomes = source.outcomes && typeof source.outcomes === "object" ? source.outcomes : {};
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

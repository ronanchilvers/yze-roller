import {
  ATTRIBUTE_DICE_OPTS,
  SKILL_DICE_OPTS,
  STRAIN_DICE_OPTS,
  normalizeDiceCount,
} from "./dice.js";

export const MIN_ROLL_MODIFIER = -3;
export const MAX_ROLL_MODIFIER = 3;

export const ROLL_MODIFIER_OPTS = Object.freeze({
  min: MIN_ROLL_MODIFIER,
  max: MAX_ROLL_MODIFIER,
  fallback: 0,
});

export const normalizeRollModifier = (value) => {
  return normalizeDiceCount(value, ROLL_MODIFIER_OPTS);
};

export const applyRollModifierToCounts = (counts, modifier) => {
  const source = counts && typeof counts === "object" ? counts : {};
  const normalizedModifier = normalizeRollModifier(modifier);
  const normalizedStrain = normalizeDiceCount(source.strainDice, STRAIN_DICE_OPTS);
  const normalizedSkill = normalizeDiceCount(source.skillDice, SKILL_DICE_OPTS);
  const normalizedAttribute = normalizeDiceCount(
    source.attributeDice,
    ATTRIBUTE_DICE_OPTS,
  );

  if (normalizedModifier >= 0) {
    return {
      attributeDice: normalizedAttribute,
      skillDice: normalizedSkill,
      strainDice: normalizedStrain,
      modifierDice: normalizedModifier,
    };
  }

  let attributeDice = normalizedAttribute;
  let skillDice = normalizedSkill;
  let remainingRemoval = Math.abs(normalizedModifier);

  const skillRemoval = Math.min(skillDice, remainingRemoval);
  skillDice -= skillRemoval;
  remainingRemoval -= skillRemoval;

  const removableAttributeDice = Math.max(0, attributeDice - 1);
  const attributeRemoval = Math.min(removableAttributeDice, remainingRemoval);
  attributeDice -= attributeRemoval;

  return {
    attributeDice,
    skillDice,
    strainDice: normalizedStrain,
    modifierDice: 0,
  };
};

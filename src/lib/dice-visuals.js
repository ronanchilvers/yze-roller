import { DICE_TYPE } from "./dice.js";

export const DIE_COLOR = Object.freeze({
  [DICE_TYPE.ATTRIBUTE]: "#55aa5f",
  [DICE_TYPE.SKILL]: "#e1c74b",
  [DICE_TYPE.STRAIN]: "#d15c5c",
});

export const selectAnimatedDiceIds = (roll) => {
  const source = roll && typeof roll === "object" ? roll : {};
  const dice = Array.isArray(source.dice) ? source.dice : [];

  if (source.action === "roll") {
    return dice.map((die, index) => String(die?.id ?? `die-${index + 1}`));
  }

  if (source.action === "push") {
    return dice
      .filter((die) => Boolean(die?.wasPushed))
      .map((die, index) => String(die?.id ?? `die-${index + 1}`));
  }

  return [];
};

export const getDieColor = (dieType) => {
  return DIE_COLOR[dieType] ?? DIE_COLOR[DICE_TYPE.ATTRIBUTE];
};

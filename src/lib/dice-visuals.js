import { DICE_TYPE } from "./dice.js";

const DIE_COLOR = Object.freeze({
  [DICE_TYPE.ATTRIBUTE]: "#55aa5f",
  [DICE_TYPE.KEY_ATTRIBUTE]: "#185922",
  [DICE_TYPE.SKILL]: "#e1c74b",
  [DICE_TYPE.STRAIN]: "#d15c5c",
  [DICE_TYPE.MODIFIER]: "#7a4cc9",
});

export const getDieColor = (dieType) => {
  return DIE_COLOR[dieType] ?? DIE_COLOR[DICE_TYPE.ATTRIBUTE];
};

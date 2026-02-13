import { ATTRIBUTE_DICE_OPTS, SKILL_DICE_OPTS, normalizeDiceCount, sanitizePoolCounts } from "./dice.js";

export const POOL_STORAGE_KEY = "yze:dice-pool-selection:v1";
export const DEFAULT_POOL_SELECTION = Object.freeze({
  attributeDice: 3,
  skillDice: 1,
});

const sanitizeSelection = (selection, fallback = DEFAULT_POOL_SELECTION) => {
  const source = selection && typeof selection === "object" ? selection : {};
  const fallbackSource = fallback && typeof fallback === "object" ? fallback : DEFAULT_POOL_SELECTION;

  return {
    attributeDice: normalizeDiceCount(source.attributeDice, {
      ...ATTRIBUTE_DICE_OPTS,
      fallback: normalizeDiceCount(fallbackSource.attributeDice, {
        ...ATTRIBUTE_DICE_OPTS,
        fallback: DEFAULT_POOL_SELECTION.attributeDice,
      }),
    }),
    skillDice: normalizeDiceCount(source.skillDice, {
      ...SKILL_DICE_OPTS,
      fallback: normalizeDiceCount(fallbackSource.skillDice, {
        ...SKILL_DICE_OPTS,
        fallback: DEFAULT_POOL_SELECTION.skillDice,
      }),
    }),
  };
};

export const getBrowserStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

export const loadPoolSelection = (storageLike, fallback = DEFAULT_POOL_SELECTION) => {
  const safeFallback = sanitizeSelection(null, fallback);

  if (!storageLike || typeof storageLike.getItem !== "function") {
    return safeFallback;
  }

  try {
    const rawValue = storageLike.getItem(POOL_STORAGE_KEY);

    if (!rawValue) {
      return safeFallback;
    }

    const parsed = JSON.parse(rawValue);
    const sanitized = sanitizePoolCounts(parsed);

    return sanitizeSelection(
      {
        attributeDice: sanitized.attributeDice,
        skillDice: sanitized.skillDice,
      },
      safeFallback,
    );
  } catch {
    return safeFallback;
  }
};

export const savePoolSelection = (storageLike, selection) => {
  if (!storageLike || typeof storageLike.setItem !== "function") {
    return false;
  }

  try {
    const sanitized = sanitizeSelection(selection);

    storageLike.setItem(
      POOL_STORAGE_KEY,
      JSON.stringify({
        attributeDice: sanitized.attributeDice,
        skillDice: sanitized.skillDice,
      }),
    );

    return true;
  } catch {
    return false;
  }
};

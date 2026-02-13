import {
  ATTRIBUTE_DICE_OPTS,
  SKILL_DICE_OPTS,
  normalizeDiceCount,
  sanitizePoolCounts,
} from "./dice.js";

export const POOL_STORAGE_KEY = "yze:dice-pool-selection:v1";
export const DEFAULT_POOL_SELECTION = Object.freeze({
  attributeDice: 3,
  skillDice: 1,
});

// Maximum safe size for localStorage values (1 KB threshold)
// Protects against excessive memory allocation from malicious/corrupted entries
const MAX_STORAGE_VALUE_SIZE = 1024;

const sanitizeSelection = (selection, fallback = DEFAULT_POOL_SELECTION) => {
  const source = selection && typeof selection === "object" ? selection : {};
  const fallbackSource =
    fallback && typeof fallback === "object"
      ? fallback
      : DEFAULT_POOL_SELECTION;

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

export const loadPoolSelection = (
  storageLike,
  fallback = DEFAULT_POOL_SELECTION,
) => {
  const safeFallback = sanitizeSelection(null, fallback);

  if (!storageLike || typeof storageLike.getItem !== "function") {
    return safeFallback;
  }

  try {
    const rawValue = storageLike.getItem(POOL_STORAGE_KEY);

    if (!rawValue) {
      return safeFallback;
    }

    // Size guard: reject oversized values before parsing
    // Prevents excessive memory allocation from malicious/corrupted entries
    if (rawValue.length > MAX_STORAGE_VALUE_SIZE) {
      console.warn(
        `Pool selection data exceeds size limit (${rawValue.length} > ${MAX_STORAGE_VALUE_SIZE} bytes). Using fallback.`,
      );
      return safeFallback;
    }

    const parsed = JSON.parse(rawValue);

    // Explicit allowlist: only accept known fields, discard everything else
    // This prevents prototype pollution and unexpected nested structures
    const allowlisted = {
      attributeDice: parsed?.attributeDice,
      skillDice: parsed?.skillDice,
    };

    const sanitized = sanitizePoolCounts(allowlisted);

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

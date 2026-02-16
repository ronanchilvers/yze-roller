export const THEME_PREFERENCE_STORAGE_KEY = "yze:theme-preference:v1";
export const THEME_PREFERENCES = Object.freeze(["light", "dark", "system"]);
export const DEFAULT_THEME_PREFERENCE = "system";

// Maximum safe size for localStorage values (256 bytes threshold)
// Protects against excessive memory allocation from malicious/corrupted entries
const MAX_STORAGE_VALUE_SIZE = 256;

const isThemePreference = (value) => THEME_PREFERENCES.includes(value);

export const sanitizeThemePreference = (
  preference,
  fallback = DEFAULT_THEME_PREFERENCE,
) => {
  const safeFallback = isThemePreference(fallback)
    ? fallback
    : DEFAULT_THEME_PREFERENCE;

  return isThemePreference(preference) ? preference : safeFallback;
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

export const loadThemePreference = (
  storageLike,
  fallback = DEFAULT_THEME_PREFERENCE,
) => {
  const safeFallback = sanitizeThemePreference(null, fallback);

  if (!storageLike || typeof storageLike.getItem !== "function") {
    return safeFallback;
  }

  try {
    const rawValue = storageLike.getItem(THEME_PREFERENCE_STORAGE_KEY);

    if (!rawValue) {
      return safeFallback;
    }

    if (rawValue.length > MAX_STORAGE_VALUE_SIZE) {
      console.warn(
        `Theme preference data exceeds size limit (${rawValue.length} > ${MAX_STORAGE_VALUE_SIZE} bytes). Using fallback.`,
      );
      return safeFallback;
    }

    const parsed = JSON.parse(rawValue);
    const preference =
      parsed && typeof parsed === "object" ? parsed.preference : parsed;

    return sanitizeThemePreference(preference, safeFallback);
  } catch {
    return safeFallback;
  }
};

export const saveThemePreference = (storageLike, preference) => {
  if (!storageLike || typeof storageLike.setItem !== "function") {
    return false;
  }

  try {
    const sanitized = sanitizeThemePreference(preference);
    storageLike.setItem(
      THEME_PREFERENCE_STORAGE_KEY,
      JSON.stringify({ preference: sanitized }),
    );
    return true;
  } catch {
    return false;
  }
};

import { useEffect, useMemo, useState } from "react";
import {
  getBrowserStorage,
  loadThemePreference,
  sanitizeThemePreference,
  saveThemePreference,
} from "../lib/theme-preference.js";

const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

const getSystemTheme = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  try {
    return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
};

export const useThemePreference = () => {
  const [storage] = useState(() => getBrowserStorage());
  const [themePreference, setThemePreferenceState] = useState(() =>
    loadThemePreference(storage),
  );
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());

  useEffect(() => {
    saveThemePreference(storage, themePreference);
  }, [storage, themePreference]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    const onThemeChange = (event) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onThemeChange);
      return () => {
        mediaQuery.removeEventListener("change", onThemeChange);
      };
    }

    if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(onThemeChange);
      return () => {
        mediaQuery.removeListener(onThemeChange);
      };
    }

    return undefined;
  }, []);

  const resolvedTheme = useMemo(
    () => (themePreference === "system" ? systemTheme : themePreference),
    [themePreference, systemTheme],
  );

  const setThemePreference = (nextPreference) => {
    setThemePreferenceState((currentPreference) =>
      sanitizeThemePreference(nextPreference, currentPreference),
    );
  };

  return {
    themePreference,
    resolvedTheme,
    setThemePreference,
  };
};

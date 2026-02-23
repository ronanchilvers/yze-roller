const DEFAULT_API_BASE_URL = "/api";
const API_BASE_URL_ENV_KEY = "VITE_API_BASE_URL";

const hasOwn = (value, key) =>
  Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const trimTrailingSlashes = (value) => value.replace(/\/+$/, "");

export const normalizeApiBaseUrl = (value) => {
  if (typeof value !== "string") {
    throw new Error(
      `${API_BASE_URL_ENV_KEY} must be a string when provided in runtime config.`,
    );
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(
      `${API_BASE_URL_ENV_KEY} must not be empty when provided in runtime config.`,
    );
  }

  if (trimmedValue === "/") {
    return "/";
  }

  return trimTrailingSlashes(trimmedValue);
};

export const getApiBaseUrl = (env = import.meta.env) => {
  if (!hasOwn(env, API_BASE_URL_ENV_KEY)) {
    return DEFAULT_API_BASE_URL;
  }

  return normalizeApiBaseUrl(env[API_BASE_URL_ENV_KEY]);
};

export const buildApiUrl = (path, env = import.meta.env) => {
  if (typeof path !== "string") {
    throw new Error("API request path must be a string.");
  }

  const trimmedPath = path.trim();

  if (!trimmedPath) {
    throw new Error("API request path must not be empty.");
  }

  const normalizedPath = trimmedPath.startsWith("/")
    ? trimmedPath
    : `/${trimmedPath}`;
  const apiBaseUrl = getApiBaseUrl(env);

  if (apiBaseUrl === "/") {
    return normalizedPath;
  }

  return `${apiBaseUrl}${normalizedPath}`;
};

export { API_BASE_URL_ENV_KEY, DEFAULT_API_BASE_URL };

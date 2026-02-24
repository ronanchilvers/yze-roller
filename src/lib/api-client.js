import { buildApiUrl } from "./app-config.js";

const isObjectLike = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeErrorCode = (status) => `HTTP_${status}`;

const normalizeErrorMessage = (status) =>
  `Request failed with status ${status}.`;

const parseJsonBody = async (response) => {
  const bodyText = await response.text();

  if (!bodyText) {
    return null;
  }

  return JSON.parse(bodyText);
};

const tryParseJsonBody = async (response) => {
  try {
    return await parseJsonBody(response);
  } catch {
    return null;
  }
};

/**
 * @param {unknown} payload
 * @returns {{ code: string, message: string, details?: Record<string, unknown> } | null}
 */
export const parseApiErrorEnvelope = (payload) => {
  if (!isObjectLike(payload) || !isObjectLike(payload.error)) {
    return null;
  }

  const { code, message, details } = payload.error;

  if (typeof code !== "string" || !code.trim()) {
    return null;
  }

  if (typeof message !== "string" || !message.trim()) {
    return null;
  }

  const parsed = {
    code: code.trim(),
    message: message.trim(),
  };

  if (isObjectLike(details)) {
    parsed.details = details;
  }

  return parsed;
};

export class ApiClientError extends Error {
  /**
   * @param {{
   *   status: number,
   *   code: string,
   *   message: string,
   *   details?: Record<string, unknown>,
   *   cause?: unknown,
   * }} input
   */
  constructor({ status, code, message, details, cause }) {
    super(message, { cause });
    this.name = "ApiClientError";
    this.status = Number.isFinite(status) ? Number(status) : 0;
    this.code = typeof code === "string" ? code : "UNKNOWN_ERROR";
    this.details = isObjectLike(details) ? details : undefined;
  }
}

/**
 * @param {unknown} value
 * @returns {value is ApiClientError}
 */
export const isApiClientError = (value) => value instanceof ApiClientError;

/**
 * Performs an API request and returns parsed JSON responses.
 * Throws ApiClientError for non-2xx responses and malformed JSON.
 *
 * @param {string} path
 * @param {{
 *   token?: string | null,
 *   method?: string,
 *   body?: unknown,
 *   signal?: AbortSignal,
 *   headers?: Record<string, string>,
 *   fetchImpl?: typeof fetch,
 *   env?: Record<string, unknown>,
 * }} [options]
 * @returns {Promise<{ status: number, data: unknown, headers: Headers }>}
 */
export const apiFetch = async (path, options = {}) => {
  const {
    token = null,
    method = "GET",
    body,
    signal,
    headers = {},
    fetchImpl = globalThis.fetch,
    env = import.meta.env,
  } = options;

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }

  const requestHeaders = {
    Accept: "application/json",
    ...headers,
  };

  if (typeof token === "string" && token.trim()) {
    requestHeaders.Authorization = `Bearer ${token.trim()}`;
  }

  /** @type {RequestInit} */
  const requestInit = {
    method,
    headers: requestHeaders,
  };

  if (signal) {
    requestInit.signal = signal;
  }

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    requestInit.body = JSON.stringify(body);
  }

  const requestUrl = buildApiUrl(path, env);
  const response = await fetchImpl(requestUrl, requestInit);

  if (response.status === 204) {
    return { status: 204, data: null, headers: response.headers };
  }

  if (response.ok) {
    try {
      const parsedBody = await parseJsonBody(response);
      return {
        status: response.status,
        data: parsedBody,
        headers: response.headers,
      };
    } catch (cause) {
      throw new ApiClientError({
        status: response.status,
        code: "RESPONSE_INVALID",
        message: "API response was not valid JSON.",
        cause,
      });
    }
  }

  const parsedBody = await tryParseJsonBody(response);
  const parsedError = parseApiErrorEnvelope(parsedBody);

  throw new ApiClientError({
    status: response.status,
    code: parsedError?.code ?? normalizeErrorCode(response.status),
    message: parsedError?.message ?? normalizeErrorMessage(response.status),
    details: parsedError?.details,
  });
};

/**
 * @template T
 * @param {string} path
 * @param {Omit<Parameters<typeof apiFetch>[1], "method">} [options]
 * @returns {Promise<{ status: number, data: T, headers: Headers }>}
 */
export const apiGet = (path, options = {}) =>
  apiFetch(path, { ...options, method: "GET" });

/**
 * @template T
 * @param {string} path
 * @param {unknown} body
 * @param {Omit<Parameters<typeof apiFetch>[1], "method" | "body">} [options]
 * @returns {Promise<{ status: number, data: T, headers: Headers }>}
 */
export const apiPost = (path, body, options = {}) =>
  apiFetch(path, { ...options, method: "POST", body });

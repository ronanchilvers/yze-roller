import { apiGet, isApiClientError } from "./api-client.js";
import { cryptoRandom } from "./secure-random.js";

export const EVENTS_POLL_LIMIT = 10;
export const DEFAULT_POLL_INTERVAL_MS = 500;
export const MAX_IDLE_POLL_INTERVAL_MS = 5000;
export const MAX_ERROR_POLL_INTERVAL_MS = 5000;
export const POLL_REQUEST_TIMEOUT_MS = 5000;
export const IDLE_BACKOFF_START_AFTER_POLLS = 3;
export const IDLE_BACKOFF_MULTIPLIER = 1.25;

export const INITIAL_MULTIPLAYER_SESSION_STATE = Object.freeze({
  status: "idle",
  sessionId: null,
  sessionName: "",
  joiningEnabled: false,
  role: null,
  self: null,
  sceneStrain: 0,
  latestEventId: 0,
  sinceId: 0,
  players: [],
  events: [],
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  pollingStatus: "idle",
  errorCode: null,
  errorMessage: "",
});

export const isObjectLike = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const normalizeNonNegativeInteger = (value, fallback = 0) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.floor(numeric);
};

export const normalizeEventList = (value) =>
  Array.isArray(value) ? value.filter(isObjectLike) : [];

export const normalizeRole = (value) =>
  value === "gm" || value === "player" ? value : null;

export const normalizeDisplayName = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

export const normalizePlayerSummary = (value) => {
  if (!isObjectLike(value)) {
    return null;
  }

  const tokenId = normalizeNonNegativeInteger(value.token_id, -1);
  const role = normalizeRole(value.role);
  const displayName = normalizeDisplayName(value.display_name);

  if (tokenId < 0 || !role || !displayName) {
    return null;
  }

  return {
    tokenId,
    role,
    displayName,
  };
};

export const normalizeGmPlayers = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((player) => !player?.revoked)
    .map(normalizePlayerSummary)
    .filter(Boolean);
};

export const normalizeOutcomeCount = (value) => {
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 99) {
    return null;
  }

  return numeric;
};

export const validateRollPayload = (payload) => {
  if (!isObjectLike(payload)) {
    return null;
  }

  const successes = normalizeOutcomeCount(payload.successes);
  const banes = normalizeOutcomeCount(payload.banes);

  if (successes === null || banes === null) {
    return null;
  }

  return {
    successes,
    banes,
  };
};

export const validatePushPayload = (payload) => {
  if (!isObjectLike(payload)) {
    return null;
  }

  const normalizedRollPayload = validateRollPayload(payload);

  if (!normalizedRollPayload || typeof payload.strain !== "boolean") {
    return null;
  }

  return {
    ...normalizedRollPayload,
    strain: payload.strain,
  };
};

export const isAuthFailure = (error) => {
  if (!isApiClientError(error)) {
    return false;
  }

  if (error.status === 401 || error.status === 403) {
    return true;
  }

  return (
    error.code === "TOKEN_MISSING" ||
    error.code === "TOKEN_INVALID" ||
    error.code === "TOKEN_REVOKED"
  );
};

export const buildEventsPath = (sinceId) =>
  `/events?since_id=${normalizeNonNegativeInteger(sinceId, 0)}&limit=${EVENTS_POLL_LIMIT}`;

export const requestEventsWithTimeout = async (
  path,
  token,
  requestEvents = apiGet,
) => {
  const timeoutMs = normalizeNonNegativeInteger(POLL_REQUEST_TIMEOUT_MS, 0);
  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  const requestOptions = controller
    ? {
        token,
        signal: controller.signal,
      }
    : { token };
  const requestPromise = requestEvents(path, requestOptions);

  if (timeoutMs <= 0) {
    return requestPromise;
  }

  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (controller) {
        try {
          controller.abort();
        } catch {
          // Ignore abort errors and rely on timeout rejection path.
        }
      }

      reject(new Error("Polling request timed out."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
};

export const scaleIdleInterval = (currentIntervalMs) =>
  Math.min(
    MAX_IDLE_POLL_INTERVAL_MS,
    Math.max(
      DEFAULT_POLL_INTERVAL_MS,
      Math.round(
        normalizeNonNegativeInteger(currentIntervalMs, DEFAULT_POLL_INTERVAL_MS) *
          IDLE_BACKOFF_MULTIPLIER,
      ),
    ),
  );

export const buildErrorBackoffIntervalMs = (
  currentIntervalMs,
  randomValue = cryptoRandom(),
) => {
  const numericRandom = Number.isFinite(randomValue) ? randomValue : 0.5;
  const clampedRandom = Math.min(1, Math.max(0, numericRandom));
  const nextBase = Math.min(
    MAX_ERROR_POLL_INTERVAL_MS,
    Math.max(
      DEFAULT_POLL_INTERVAL_MS,
      normalizeNonNegativeInteger(currentIntervalMs, DEFAULT_POLL_INTERVAL_MS) * 2,
    ),
  );
  const jitterFactor = 0.8 + clampedRandom * 0.4;

  return Math.min(
    MAX_ERROR_POLL_INTERVAL_MS,
    Math.max(DEFAULT_POLL_INTERVAL_MS, Math.round(nextBase * jitterFactor)),
  );
};

export const extractNextSinceId = (
  currentSinceId,
  eventsPayload,
  nextSinceIdValue,
) => {
  const parsedNextSinceId = normalizeNonNegativeInteger(nextSinceIdValue, -1);

  if (parsedNextSinceId >= 0) {
    return parsedNextSinceId;
  }

  const lastEvent = eventsPayload.at(-1);
  const lastEventId = normalizeNonNegativeInteger(lastEvent?.id, -1);

  if (lastEventId >= 0) {
    return lastEventId;
  }

  return normalizeNonNegativeInteger(currentSinceId, 0);
};

export const buildAuthLostState = (error) => ({
  ...INITIAL_MULTIPLAYER_SESSION_STATE,
  status: "auth_lost",
  pollingStatus: "stopped",
  errorCode: isApiClientError(error) ? error.code : "TOKEN_INVALID",
  errorMessage: isApiClientError(error)
    ? error.message
    : "Session authorization is no longer valid.",
});

export const getGmContext = (sessionState, sessionToken) => {
  const sessionId = normalizeNonNegativeInteger(sessionState?.sessionId, -1);
  const role = sessionState?.role;

  if (!sessionToken) {
    return {
      ok: false,
      errorCode: "TOKEN_MISSING",
      errorMessage: "Session token is missing.",
    };
  }

  if (role !== "gm") {
    return {
      ok: false,
      errorCode: "ROLE_FORBIDDEN",
      errorMessage: "GM role is required for this action.",
    };
  }

  if (sessionId < 0) {
    return {
      ok: false,
      errorCode: "SESSION_NOT_FOUND",
      errorMessage: "Session id is unavailable.",
    };
  }

  return {
    ok: true,
    sessionId,
  };
};

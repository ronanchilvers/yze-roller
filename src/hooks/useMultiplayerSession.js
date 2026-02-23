import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, isApiClientError } from "../lib/api-client.js";
import { clearSessionAuth, getSessionAuth } from "../lib/session-auth.js";
import { normalizeSessionSnapshot } from "../lib/session-snapshot.js";

export const EVENTS_POLL_LIMIT = 10;
export const DEFAULT_POLL_INTERVAL_MS = 1000;
export const MAX_IDLE_POLL_INTERVAL_MS = 8000;
export const MAX_ERROR_POLL_INTERVAL_MS = 30000;

const INITIAL_MULTIPLAYER_SESSION_STATE = Object.freeze({
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

const isObjectLike = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeNonNegativeInteger = (value, fallback = 0) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.floor(numeric);
};

const normalizeEventList = (value) =>
  Array.isArray(value) ? value.filter(isObjectLike) : [];

const isAuthFailure = (error) => {
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

const buildEventsPath = (sinceId) =>
  `/events?since_id=${normalizeNonNegativeInteger(sinceId, 0)}&limit=${EVENTS_POLL_LIMIT}`;

const scaleIdleInterval = (currentIntervalMs) =>
  Math.min(
    MAX_IDLE_POLL_INTERVAL_MS,
    Math.max(
      DEFAULT_POLL_INTERVAL_MS,
      Math.round(normalizeNonNegativeInteger(currentIntervalMs, DEFAULT_POLL_INTERVAL_MS) * 1.5),
    ),
  );

export const buildErrorBackoffIntervalMs = (
  currentIntervalMs,
  randomValue = Math.random(),
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

const extractNextSinceId = (currentSinceId, eventsPayload, nextSinceIdValue) => {
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

export const useMultiplayerSession = () => {
  const [sessionState, setSessionState] = useState(
    INITIAL_MULTIPLAYER_SESSION_STATE,
  );

  const pollTimerRef = useRef(null);
  const pollIntervalRef = useRef(DEFAULT_POLL_INTERVAL_MS);
  const sinceIdRef = useRef(0);
  const sessionTokenRef = useRef("");
  const pollingActiveRef = useRef(false);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    pollingActiveRef.current = false;
    sessionTokenRef.current = "";
    pollIntervalRef.current = DEFAULT_POLL_INTERVAL_MS;
    clearPollTimer();

    setSessionState((current) => ({
      ...current,
      pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
      pollingStatus: "stopped",
    }));
  }, [clearPollTimer]);

  const runPollCycle = useCallback(async () => {
    if (!pollingActiveRef.current || !sessionTokenRef.current) {
      return;
    }

    try {
      const response = await apiGet(buildEventsPath(sinceIdRef.current), {
        token: sessionTokenRef.current,
      });

      if (!pollingActiveRef.current) {
        return;
      }

      if (response.status === 204) {
        const nextInterval = scaleIdleInterval(pollIntervalRef.current);
        pollIntervalRef.current = nextInterval;

        setSessionState((current) => ({
          ...current,
          pollIntervalMs: nextInterval,
          pollingStatus: "backoff",
        }));

        pollTimerRef.current = setTimeout(() => {
          void runPollCycle();
        }, nextInterval);
        return;
      }

      const payload = isObjectLike(response.data) ? response.data : {};
      const nextEvents = normalizeEventList(payload.events);
      const nextSinceId = extractNextSinceId(
        sinceIdRef.current,
        nextEvents,
        payload.next_since_id,
      );

      sinceIdRef.current = nextSinceId;
      pollIntervalRef.current = DEFAULT_POLL_INTERVAL_MS;

      setSessionState((current) => ({
        ...current,
        events: [...current.events, ...nextEvents],
        sinceId: nextSinceId,
        latestEventId: Math.max(current.latestEventId, nextSinceId),
        pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        pollingStatus: "running",
        errorCode: null,
        errorMessage: "",
      }));

      pollTimerRef.current = setTimeout(() => {
        void runPollCycle();
      }, DEFAULT_POLL_INTERVAL_MS);
    } catch (error) {
      if (!pollingActiveRef.current) {
        return;
      }

      if (isAuthFailure(error)) {
        clearSessionAuth();
        pollingActiveRef.current = false;
        sessionTokenRef.current = "";
        clearPollTimer();

        setSessionState({
          ...INITIAL_MULTIPLAYER_SESSION_STATE,
          status: "auth_lost",
          pollingStatus: "stopped",
          errorCode: isApiClientError(error) ? error.code : "TOKEN_INVALID",
          errorMessage: isApiClientError(error)
            ? error.message
            : "Session authorization is no longer valid.",
        });
        return;
      }

      const nextInterval = buildErrorBackoffIntervalMs(pollIntervalRef.current);
      pollIntervalRef.current = nextInterval;

      setSessionState((current) => ({
        ...current,
        pollIntervalMs: nextInterval,
        pollingStatus: "backoff",
        errorCode: isApiClientError(error) ? error.code : "NETWORK_ERROR",
        errorMessage: isApiClientError(error)
          ? error.message
          : "Unable to fetch session events.",
      }));

      pollTimerRef.current = setTimeout(() => {
        void runPollCycle();
      }, nextInterval);
    }
  }, [clearPollTimer]);

  const startPolling = useCallback(
    (sessionToken, sinceId) => {
      const normalizedToken =
        typeof sessionToken === "string" ? sessionToken.trim() : "";

      if (!normalizedToken) {
        return;
      }

      clearPollTimer();
      pollingActiveRef.current = true;
      sessionTokenRef.current = normalizedToken;
      sinceIdRef.current = normalizeNonNegativeInteger(sinceId, 0);
      pollIntervalRef.current = DEFAULT_POLL_INTERVAL_MS;

      setSessionState((current) => ({
        ...current,
        sinceId: sinceIdRef.current,
        pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
        pollingStatus: "running",
      }));

      pollTimerRef.current = setTimeout(() => {
        void runPollCycle();
      }, DEFAULT_POLL_INTERVAL_MS);
    },
    [clearPollTimer, runPollCycle],
  );

  const bootstrapFromAuth = useCallback(async () => {
    const authState = getSessionAuth();
    const sessionToken =
      typeof authState?.sessionToken === "string"
        ? authState.sessionToken.trim()
        : "";

    if (!sessionToken) {
      stopPolling();
      setSessionState(INITIAL_MULTIPLAYER_SESSION_STATE);
      return null;
    }

    setSessionState((current) => ({
      ...current,
      status: "loading",
      errorCode: null,
      errorMessage: "",
    }));

    try {
      const response = await apiGet("/session", {
        token: sessionToken,
      });
      const normalized = normalizeSessionSnapshot(response.data);

      sinceIdRef.current = normalized.sinceId;
      setSessionState({
        ...INITIAL_MULTIPLAYER_SESSION_STATE,
        ...normalized,
        status: "ready",
      });
      startPolling(sessionToken, normalized.sinceId);

      return normalized;
    } catch (error) {
      stopPolling();

      if (isAuthFailure(error)) {
        clearSessionAuth();
        setSessionState({
          ...INITIAL_MULTIPLAYER_SESSION_STATE,
          status: "auth_lost",
          pollingStatus: "stopped",
          errorCode: isApiClientError(error) ? error.code : "TOKEN_INVALID",
          errorMessage: isApiClientError(error)
            ? error.message
            : "Session authorization is no longer valid.",
        });
        return null;
      }

      setSessionState((current) => ({
        ...current,
        status: "error",
        errorCode: isApiClientError(error) ? error.code : "NETWORK_ERROR",
        errorMessage: isApiClientError(error)
          ? error.message
          : "Unable to load session snapshot.",
      }));

      return null;
    }
  }, [startPolling, stopPolling]);

  const resetSession = useCallback(() => {
    clearSessionAuth();
    stopPolling();
    setSessionState(INITIAL_MULTIPLAYER_SESSION_STATE);
  }, [stopPolling]);

  useEffect(
    () => () => {
      pollingActiveRef.current = false;
      clearPollTimer();
    },
    [clearPollTimer],
  );

  return {
    sessionState,
    bootstrapFromAuth,
    stopPolling,
    resetSession,
  };
};

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost, isApiClientError } from "../lib/api-client.js";
import { clearSessionAuth, getSessionAuth } from "../lib/session-auth.js";
import { normalizeSessionSnapshot } from "../lib/session-snapshot.js";
import { applySessionEvents } from "../lib/multiplayer-event-reducer.js";

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

const normalizeRole = (value) =>
  value === "gm" || value === "player" ? value : null;

const normalizeDisplayName = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizePlayerSummary = (value) => {
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

const normalizeGmPlayers = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((player) => !player?.revoked)
    .map(normalizePlayerSummary)
    .filter(Boolean);
};

const normalizeOutcomeCount = (value) => {
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 99) {
    return null;
  }

  return numeric;
};

const validateRollPayload = (payload) => {
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

const validatePushPayload = (payload) => {
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

const buildAuthLostState = (error) => ({
  ...INITIAL_MULTIPLAYER_SESSION_STATE,
  status: "auth_lost",
  pollingStatus: "stopped",
  errorCode: isApiClientError(error) ? error.code : "TOKEN_INVALID",
  errorMessage: isApiClientError(error)
    ? error.message
    : "Session authorization is no longer valid.",
});

const getGmContext = (sessionState, sessionToken) => {
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

export const useMultiplayerSession = () => {
  const [sessionState, setSessionState] = useState(
    INITIAL_MULTIPLAYER_SESSION_STATE,
  );
  const sessionStateRef = useRef(INITIAL_MULTIPLAYER_SESSION_STATE);

  const pollTimerRef = useRef(null);
  const pollIntervalRef = useRef(DEFAULT_POLL_INTERVAL_MS);
  const sinceIdRef = useRef(0);
  const sessionTokenRef = useRef("");
  const pollingActiveRef = useRef(false);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

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
          pollingStatus: "running",
          errorCode: null,
          errorMessage: "",
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

      setSessionState((current) => {
        const reducedState = applySessionEvents(current, nextEvents);

        return {
          ...reducedState,
          sinceId: nextSinceId,
          latestEventId: Math.max(reducedState.latestEventId, nextSinceId),
          pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
          pollingStatus: "running",
          errorCode: null,
          errorMessage: "",
        };
      });

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
        setSessionState(buildAuthLostState(error));
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
        setSessionState(buildAuthLostState(error));
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

  const submitRoll = useCallback(
    async (payloadInput) => {
      const validatedPayload = validateRollPayload(payloadInput);

      if (!validatedPayload) {
        return {
          ok: false,
          errorCode: "VALIDATION_ERROR",
          errorMessage: "Roll payload must include integer successes/banes in range 0..99.",
        };
      }

      if (!sessionTokenRef.current) {
        return {
          ok: false,
          errorCode: "TOKEN_MISSING",
          errorMessage: "Session token is missing.",
        };
      }

      try {
        const response = await apiPost(
          "/events",
          {
            type: "roll",
            payload: validatedPayload,
          },
          {
            token: sessionTokenRef.current,
          },
        );
        const payload = isObjectLike(response.data) ? response.data : {};
        const responseEvent = isObjectLike(payload.event) ? payload.event : null;
        const responseEventId = normalizeNonNegativeInteger(responseEvent?.id, -1);

        if (responseEventId >= 0) {
          sinceIdRef.current = Math.max(sinceIdRef.current, responseEventId);
        }

        setSessionState((current) => {
          const nextState = responseEvent
            ? applySessionEvents(current, [responseEvent])
            : current;

          return {
            ...nextState,
            sinceId: responseEventId >= 0
              ? Math.max(nextState.sinceId, responseEventId)
              : nextState.sinceId,
          };
        });

        return {
          ok: true,
          event: responseEvent,
        };
      } catch (error) {
        if (isAuthFailure(error)) {
          clearSessionAuth();
          stopPolling();
          setSessionState(buildAuthLostState(error));
          return {
            ok: false,
            errorCode: isApiClientError(error) ? error.code : "TOKEN_INVALID",
            errorMessage: isApiClientError(error)
              ? error.message
              : "Session authorization is no longer valid.",
          };
        }

        return {
          ok: false,
          errorCode: isApiClientError(error) ? error.code : "NETWORK_ERROR",
          errorMessage: isApiClientError(error)
            ? error.message
            : "Unable to submit roll event.",
        };
      }
    },
    [stopPolling],
  );

  const submitPush = useCallback(
    async (payloadInput) => {
      const validatedPayload = validatePushPayload(payloadInput);

      if (!validatedPayload) {
        return {
          ok: false,
          errorCode: "VALIDATION_ERROR",
          errorMessage:
            "Push payload must include integer successes/banes (0..99) and boolean strain.",
        };
      }

      if (!sessionTokenRef.current) {
        return {
          ok: false,
          errorCode: "TOKEN_MISSING",
          errorMessage: "Session token is missing.",
        };
      }

      try {
        const response = await apiPost(
          "/events",
          {
            type: "push",
            payload: validatedPayload,
          },
          {
            token: sessionTokenRef.current,
          },
        );
        const payload = isObjectLike(response.data) ? response.data : {};
        const responseEvent = isObjectLike(payload.event) ? payload.event : null;
        const responseEventId = normalizeNonNegativeInteger(responseEvent?.id, -1);
        const responseSceneStrain = normalizeNonNegativeInteger(
          payload.scene_strain,
          null,
        );

        if (responseEventId >= 0) {
          sinceIdRef.current = Math.max(sinceIdRef.current, responseEventId);
        }

        setSessionState((current) => {
          const reducedState = responseEvent
            ? applySessionEvents(current, [responseEvent])
            : current;
          const nextSceneStrain =
            responseSceneStrain === null
              ? reducedState.sceneStrain
              : responseSceneStrain;

          return {
            ...reducedState,
            sceneStrain: nextSceneStrain,
            sinceId: responseEventId >= 0
              ? Math.max(reducedState.sinceId, responseEventId)
              : reducedState.sinceId,
          };
        });

        return {
          ok: true,
          event: responseEvent,
        };
      } catch (error) {
        if (isAuthFailure(error)) {
          clearSessionAuth();
          stopPolling();
          setSessionState(buildAuthLostState(error));
          return {
            ok: false,
            errorCode: isApiClientError(error) ? error.code : "TOKEN_INVALID",
            errorMessage: isApiClientError(error)
              ? error.message
              : "Session authorization is no longer valid.",
          };
        }

        return {
          ok: false,
          errorCode: isApiClientError(error) ? error.code : "NETWORK_ERROR",
          errorMessage: isApiClientError(error)
            ? error.message
            : "Unable to submit push event.",
        };
      }
    },
    [stopPolling],
  );

  const rotateJoinLink = useCallback(async () => {
    const gmContext = getGmContext(
      sessionStateRef.current,
      sessionTokenRef.current,
    );

    if (!gmContext.ok) {
      return gmContext;
    }

    try {
      const response = await apiPost(
        `/sessions/${gmContext.sessionId}/join-link/rotate`,
        {},
        {
          token: sessionTokenRef.current,
        },
      );
      const payload = isObjectLike(response.data) ? response.data : {};

      return {
        ok: true,
        joinLink:
          typeof payload.join_link === "string" ? payload.join_link.trim() : "",
      };
    } catch (error) {
      if (isAuthFailure(error)) {
        clearSessionAuth();
        stopPolling();
        setSessionState(buildAuthLostState(error));
      }

      return {
        ok: false,
        errorCode: isApiClientError(error) ? error.code : "NETWORK_ERROR",
        errorMessage: isApiClientError(error)
          ? error.message
          : "Unable to rotate join link.",
      };
    }
  }, [stopPolling]);

  const setJoiningEnabled = useCallback(
    async (joiningEnabled) => {
      if (typeof joiningEnabled !== "boolean") {
        return {
          ok: false,
          errorCode: "VALIDATION_ERROR",
          errorMessage: "joining_enabled must be a boolean.",
        };
      }

      const gmContext = getGmContext(
        sessionStateRef.current,
        sessionTokenRef.current,
      );

      if (!gmContext.ok) {
        return gmContext;
      }

      try {
        const response = await apiPost(
          `/gm/sessions/${gmContext.sessionId}/joining`,
          {
            joining_enabled: joiningEnabled,
          },
          {
            token: sessionTokenRef.current,
          },
        );
        const payload = isObjectLike(response.data) ? response.data : {};
        const nextJoiningEnabled =
          typeof payload.joining_enabled === "boolean"
            ? payload.joining_enabled
            : joiningEnabled;

        setSessionState((current) => ({
          ...current,
          joiningEnabled: nextJoiningEnabled,
        }));

        return {
          ok: true,
          joiningEnabled: nextJoiningEnabled,
        };
      } catch (error) {
        if (isAuthFailure(error)) {
          clearSessionAuth();
          stopPolling();
          setSessionState(buildAuthLostState(error));
        }

        return {
          ok: false,
          errorCode: isApiClientError(error) ? error.code : "NETWORK_ERROR",
          errorMessage: isApiClientError(error)
            ? error.message
            : "Unable to update joining state.",
        };
      }
    },
    [stopPolling],
  );

  const resetSceneStrain = useCallback(async () => {
    const gmContext = getGmContext(
      sessionStateRef.current,
      sessionTokenRef.current,
    );

    if (!gmContext.ok) {
      return gmContext;
    }

    try {
      const response = await apiPost(
        `/gm/sessions/${gmContext.sessionId}/reset_scene_strain`,
        {},
        {
          token: sessionTokenRef.current,
        },
      );
      const payload = isObjectLike(response.data) ? response.data : {};
      const nextSceneStrain = normalizeNonNegativeInteger(payload.scene_strain, 0);
      const resetEventId = normalizeNonNegativeInteger(payload.event_id, -1);

      if (resetEventId >= 0) {
        sinceIdRef.current = Math.max(sinceIdRef.current, resetEventId);
      }

      setSessionState((current) => ({
        ...current,
        sceneStrain: nextSceneStrain,
        sinceId: resetEventId >= 0
          ? Math.max(current.sinceId, resetEventId)
          : current.sinceId,
        latestEventId: resetEventId >= 0
          ? Math.max(current.latestEventId, resetEventId)
          : current.latestEventId,
      }));

      return {
        ok: true,
        sceneStrain: nextSceneStrain,
      };
    } catch (error) {
      if (isAuthFailure(error)) {
        clearSessionAuth();
        stopPolling();
        setSessionState(buildAuthLostState(error));
      }

      return {
        ok: false,
        errorCode: isApiClientError(error) ? error.code : "NETWORK_ERROR",
        errorMessage: isApiClientError(error)
          ? error.message
          : "Unable to reset scene strain.",
      };
    }
  }, [stopPolling]);

  const refreshPlayers = useCallback(async () => {
    const gmContext = getGmContext(
      sessionStateRef.current,
      sessionTokenRef.current,
    );

    if (!gmContext.ok) {
      return gmContext;
    }

    try {
      const response = await apiGet(`/gm/sessions/${gmContext.sessionId}/players`, {
        token: sessionTokenRef.current,
      });
      const payload = isObjectLike(response.data) ? response.data : {};
      const players = normalizeGmPlayers(payload.players);

      setSessionState((current) => ({
        ...current,
        players,
      }));

      return {
        ok: true,
        players,
      };
    } catch (error) {
      if (isAuthFailure(error)) {
        clearSessionAuth();
        stopPolling();
        setSessionState(buildAuthLostState(error));
      }

      return {
        ok: false,
        errorCode: isApiClientError(error) ? error.code : "NETWORK_ERROR",
        errorMessage: isApiClientError(error)
          ? error.message
          : "Unable to fetch player list.",
      };
    }
  }, [stopPolling]);

  const revokePlayer = useCallback(
    async (tokenIdInput) => {
      const tokenId = normalizeNonNegativeInteger(tokenIdInput, -1);

      if (tokenId < 0) {
        return {
          ok: false,
          errorCode: "VALIDATION_ERROR",
          errorMessage: "token_id must be a non-negative integer.",
        };
      }

      const gmContext = getGmContext(
        sessionStateRef.current,
        sessionTokenRef.current,
      );

      if (!gmContext.ok) {
        return gmContext;
      }

      try {
        const response = await apiPost(
          `/gm/sessions/${gmContext.sessionId}/players/${tokenId}/revoke`,
          {},
          {
            token: sessionTokenRef.current,
          },
        );
        const payload = isObjectLike(response.data) ? response.data : {};
        const eventId = normalizeNonNegativeInteger(payload.event_id, -1);
        const revoked = Boolean(payload.revoked);

        if (eventId >= 0) {
          sinceIdRef.current = Math.max(sinceIdRef.current, eventId);
        }

        if (revoked) {
          setSessionState((current) => ({
            ...current,
            players: current.players.filter((player) => player.tokenId !== tokenId),
            sinceId: eventId >= 0 ? Math.max(current.sinceId, eventId) : current.sinceId,
            latestEventId: eventId >= 0
              ? Math.max(current.latestEventId, eventId)
              : current.latestEventId,
          }));
        }

        return {
          ok: true,
          revoked,
          eventId: eventId >= 0 ? eventId : null,
        };
      } catch (error) {
        if (isAuthFailure(error)) {
          clearSessionAuth();
          stopPolling();
          setSessionState(buildAuthLostState(error));
        }

        return {
          ok: false,
          errorCode: isApiClientError(error) ? error.code : "NETWORK_ERROR",
          errorMessage: isApiClientError(error)
            ? error.message
            : "Unable to revoke player.",
        };
      }
    },
    [stopPolling],
  );

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
    submitRoll,
    submitPush,
    rotateJoinLink,
    setJoiningEnabled,
    resetSceneStrain,
    refreshPlayers,
    revokePlayer,
    stopPolling,
    resetSession,
  };
};

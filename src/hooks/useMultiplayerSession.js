import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost, isApiClientError } from "../lib/api-client.js";
import { clearSessionAuth, getSessionAuth } from "../lib/session-auth.js";
import { normalizeSessionSnapshot } from "../lib/session-snapshot.js";
import { applySessionEvents } from "../lib/multiplayer-event-reducer.js";
import { useEventPolling } from "./useEventPolling.js";
import {
  buildAuthLostState,
  buildErrorBackoffIntervalMs,
  DEFAULT_POLL_INTERVAL_MS,
  IDLE_BACKOFF_MULTIPLIER,
  IDLE_BACKOFF_START_AFTER_POLLS,
  getGmContext,
  INITIAL_MULTIPLAYER_SESSION_STATE,
  isAuthFailure,
  isObjectLike,
  MAX_ERROR_POLL_INTERVAL_MS,
  MAX_IDLE_POLL_INTERVAL_MS,
  normalizeGmPlayers,
  normalizeNonNegativeInteger,
  POLL_REQUEST_TIMEOUT_MS,
  validatePushPayload,
  validateRollPayload,
  EVENTS_POLL_LIMIT,
} from "../lib/multiplayer-normalize.js";

export {
  buildErrorBackoffIntervalMs,
  DEFAULT_POLL_INTERVAL_MS,
  EVENTS_POLL_LIMIT,
  IDLE_BACKOFF_MULTIPLIER,
  IDLE_BACKOFF_START_AFTER_POLLS,
  MAX_ERROR_POLL_INTERVAL_MS,
  MAX_IDLE_POLL_INTERVAL_MS,
  POLL_REQUEST_TIMEOUT_MS,
};

export const useMultiplayerSession = () => {
  const [sessionState, setSessionState] = useState(
    INITIAL_MULTIPLAYER_SESSION_STATE,
  );
  const sessionStateRef = useRef(INITIAL_MULTIPLAYER_SESSION_STATE);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const onPollEventsReceived = useCallback((nextEvents, nextSinceId) => {
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
  }, []);

  const onPollAuthFailure = useCallback((error) => {
    clearSessionAuth();
    setSessionState(buildAuthLostState(error));
  }, []);

  const {
    startPolling,
    stopPolling,
    sinceIdRef,
    sessionTokenRef,
  } = useEventPolling({
    setSessionState,
    onEventsReceived: onPollEventsReceived,
    onAuthFailure: onPollAuthFailure,
  });

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
  }, [sinceIdRef, startPolling, stopPolling]);

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
    [sessionTokenRef, sinceIdRef, stopPolling],
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
    [sessionTokenRef, sinceIdRef, stopPolling],
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
  }, [sessionTokenRef, stopPolling]);

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
    [sessionTokenRef, stopPolling],
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
  }, [sessionTokenRef, sinceIdRef, stopPolling]);

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
  }, [sessionTokenRef, stopPolling]);

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
    [sessionTokenRef, sinceIdRef, stopPolling],
  );

  const resetSession = useCallback(() => {
    clearSessionAuth();
    stopPolling();
    setSessionState(INITIAL_MULTIPLAYER_SESSION_STATE);
  }, [stopPolling]);

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

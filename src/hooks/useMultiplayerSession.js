import { useCallback, useState } from "react";
import { apiGet, isApiClientError } from "../lib/api-client.js";
import {
  clearSessionAuth,
  getSessionAuth,
} from "../lib/session-auth.js";
import { normalizeSessionSnapshot } from "../lib/session-snapshot.js";

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
  errorCode: null,
  errorMessage: "",
});

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

export const useMultiplayerSession = () => {
  const [sessionState, setSessionState] = useState(
    INITIAL_MULTIPLAYER_SESSION_STATE,
  );

  const bootstrapFromAuth = useCallback(async () => {
    const authState = getSessionAuth();
    const sessionToken =
      typeof authState?.sessionToken === "string"
        ? authState.sessionToken.trim()
        : "";

    if (!sessionToken) {
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

      setSessionState({
        ...INITIAL_MULTIPLAYER_SESSION_STATE,
        ...normalized,
        status: "ready",
      });

      return normalized;
    } catch (error) {
      if (isAuthFailure(error)) {
        clearSessionAuth();
        setSessionState({
          ...INITIAL_MULTIPLAYER_SESSION_STATE,
          status: "auth_lost",
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
  }, []);

  const resetSession = useCallback(() => {
    clearSessionAuth();
    setSessionState(INITIAL_MULTIPLAYER_SESSION_STATE);
  }, []);

  return {
    sessionState,
    bootstrapFromAuth,
    resetSession,
  };
};

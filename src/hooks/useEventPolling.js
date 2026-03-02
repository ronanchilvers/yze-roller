import { useCallback, useEffect, useRef } from "react";
import { isApiClientError } from "../lib/api-client.js";
import {
  buildErrorBackoffIntervalMs,
  buildEventsPath,
  DEFAULT_POLL_INTERVAL_MS,
  extractNextSinceId,
  IDLE_BACKOFF_START_AFTER_POLLS,
  isAuthFailure,
  isObjectLike,
  normalizeEventList,
  normalizeNonNegativeInteger,
  requestEventsWithTimeout,
  scaleIdleInterval,
} from "../lib/multiplayer-normalize.js";

export const useEventPolling = ({
  setSessionState,
  onEventsReceived,
  onAuthFailure,
}) => {
  const pollTimerRef = useRef(null);
  const pollIntervalRef = useRef(DEFAULT_POLL_INTERVAL_MS);
  const sinceIdRef = useRef(0);
  const sessionTokenRef = useRef("");
  const pollingActiveRef = useRef(false);
  const idlePollStreakRef = useRef(0);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const runPollCycle = useCallback(async () => {
    if (!pollingActiveRef.current || !sessionTokenRef.current) {
      return;
    }

    try {
      const response = await requestEventsWithTimeout(
        buildEventsPath(sinceIdRef.current),
        sessionTokenRef.current,
      );

      if (!pollingActiveRef.current) {
        return;
      }

      if (response.status === 204) {
        idlePollStreakRef.current += 1;
        const shouldApplyIdleBackoff =
          idlePollStreakRef.current > IDLE_BACKOFF_START_AFTER_POLLS;
        const nextInterval = shouldApplyIdleBackoff
          ? scaleIdleInterval(pollIntervalRef.current)
          : DEFAULT_POLL_INTERVAL_MS;
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
      idlePollStreakRef.current = 0;
      const nextSinceId = extractNextSinceId(
        sinceIdRef.current,
        nextEvents,
        payload.next_since_id,
      );

      sinceIdRef.current = nextSinceId;
      pollIntervalRef.current = DEFAULT_POLL_INTERVAL_MS;
      onEventsReceived(nextEvents, nextSinceId);

      pollTimerRef.current = setTimeout(() => {
        void runPollCycle();
      }, DEFAULT_POLL_INTERVAL_MS);
    } catch (error) {
      if (!pollingActiveRef.current) {
        return;
      }

      if (isAuthFailure(error)) {
        pollingActiveRef.current = false;
        sessionTokenRef.current = "";
        clearPollTimer();
        onAuthFailure(error);
        return;
      }

      const nextInterval = buildErrorBackoffIntervalMs(pollIntervalRef.current);
      pollIntervalRef.current = nextInterval;
      idlePollStreakRef.current = 0;

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
  }, [clearPollTimer, onAuthFailure, onEventsReceived, setSessionState]);

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
      idlePollStreakRef.current = 0;

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
    [clearPollTimer, runPollCycle, setSessionState],
  );

  const stopPolling = useCallback(() => {
    pollingActiveRef.current = false;
    sessionTokenRef.current = "";
    pollIntervalRef.current = DEFAULT_POLL_INTERVAL_MS;
    idlePollStreakRef.current = 0;
    clearPollTimer();

    setSessionState((current) => ({
      ...current,
      pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
      pollingStatus: "stopped",
    }));
  }, [clearPollTimer, setSessionState]);

  useEffect(
    () => () => {
      pollingActiveRef.current = false;
      clearPollTimer();
    },
    [clearPollTimer],
  );

  return {
    startPolling,
    stopPolling,
    sinceIdRef,
    sessionTokenRef,
  };
};

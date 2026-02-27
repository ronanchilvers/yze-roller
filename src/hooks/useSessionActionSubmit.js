import { useEffect, useRef, useState } from "react";
import {
  buildSessionActionRequest,
  getCurrentRollActionId,
  MAX_SUBMITTED_SESSION_ACTIONS,
  normalizeActionErrorMessage,
} from "../lib/session-action-helpers.js";
import {
  MAX_TRACKED_SESSION_ROLL_TOAST_EVENTS,
  normalizeSessionEventId,
} from "../lib/session-event-normalize.js";

export const useSessionActionSubmit = ({
  currentRoll,
  recentResults,
  submitRoll,
  submitPush,
}) => {
  const [isActionSubmitPending, setIsActionSubmitPending] = useState(false);
  const [sessionActionError, setSessionActionError] = useState("");

  const submittedSessionActionsRef = useRef(new Map());
  const suppressedSessionRollEventIdsRef = useRef(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const actionRequest = buildSessionActionRequest(currentRoll);
    const actionId = getCurrentRollActionId(currentRoll, recentResults);

    if (!actionRequest || !actionId) {
      return;
    }

    const submitAction =
      actionRequest.action === "push" ? submitPush : submitRoll;

    if (typeof submitAction !== "function") {
      return;
    }

    const submittedMap = submittedSessionActionsRef.current;
    if (submittedMap.has(actionId)) {
      return;
    }

    submittedMap.set(actionId, Date.now());
    while (submittedMap.size > MAX_SUBMITTED_SESSION_ACTIONS) {
      const oldestKey = submittedMap.keys().next().value;
      if (!oldestKey) {
        break;
      }
      submittedMap.delete(oldestKey);
    }

    const syncAction = async () => {
      setIsActionSubmitPending(true);
      setSessionActionError("");

      try {
        const result = await submitAction(actionRequest.payload);

        if (!isMountedRef.current) {
          return;
        }

        if (!result?.ok) {
          setSessionActionError(
            normalizeActionErrorMessage(result?.errorMessage) ||
              "Unable to sync action with multiplayer session.",
          );
          return;
        }

        const responseEventId = normalizeSessionEventId(result?.event?.id);
        if (responseEventId !== null) {
          const suppressedSessionRollEventIds =
            suppressedSessionRollEventIdsRef.current;
          suppressedSessionRollEventIds.add(responseEventId);
          while (
            suppressedSessionRollEventIds.size >
            MAX_TRACKED_SESSION_ROLL_TOAST_EVENTS
          ) {
            const oldestEventId = suppressedSessionRollEventIds.values().next().value;
            if (typeof oldestEventId === "undefined") {
              break;
            }
            suppressedSessionRollEventIds.delete(oldestEventId);
          }
        }

        setSessionActionError("");
      } catch {
        if (!isMountedRef.current) {
          return;
        }

        setSessionActionError("Unable to sync action with multiplayer session.");
      } finally {
        if (isMountedRef.current) {
          setIsActionSubmitPending(false);
        }
      }
    };

    void syncAction();
  }, [currentRoll, recentResults, submitPush, submitRoll]);

  return {
    isActionSubmitPending,
    sessionActionError,
    suppressedSessionRollEventIdsRef,
  };
};

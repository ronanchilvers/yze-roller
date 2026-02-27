import { useCallback, useEffect, useRef } from "react";
import { useToast } from "./useToast.js";
import {
  DEFAULT_DICE_RESULT_DURATION_MS,
  MAX_PENDING_TOASTS,
} from "../components/toast/constants.js";
import {
  buildRollToastPayload,
  getRollToastDedupKey,
  ROLL_TOAST_DEDUPE_BUCKET_MS,
  normalizeRollToastEvent,
} from "../lib/roll-toast-event.js";
import {
  isSessionRollEventFromSelf,
  MAX_TRACKED_SESSION_ROLL_TOAST_EVENTS,
  normalizeSessionEventActorLabel,
  normalizeSessionEventCount,
  normalizeSessionEventHasStrain,
  normalizeSessionEventId,
  normalizeSessionEventType,
} from "../lib/session-event-normalize.js";

export const REMOTE_ROLL_EVENT_BRIDGE_KEY = "__YEAR_ZERO_REMOTE_ROLL_EVENT__";

const DEDUPE_TTL_MS = ROLL_TOAST_DEDUPE_BUCKET_MS * 2;

export const useRemoteRollToasts = ({
  sessionEvents,
  sessionSelfTokenId,
  sessionSelfDisplayName,
  sessionId,
  suppressedSessionRollEventIdsRef,
}) => {
  const toast = useToast();
  const emittedToastKeysRef = useRef(new Map());
  const emittedSessionRollEventIdsRef = useRef(new Set());

  const emitRollToastEvent = useCallback(
    (eventInput) => {
      const normalizedEvent = normalizeRollToastEvent(eventInput);
      const dedupeKey = getRollToastDedupKey(normalizedEvent);
      const now = Date.now();
      const cutoff = now - DEDUPE_TTL_MS;
      const emittedMap = emittedToastKeysRef.current;

      for (const [key, emittedAt] of emittedMap.entries()) {
        if (!Number.isFinite(emittedAt) || emittedAt < cutoff) {
          emittedMap.delete(key);
        }
      }

      if (emittedMap.has(dedupeKey)) {
        return;
      }

      const toastPayload = buildRollToastPayload(normalizedEvent);

      if (typeof toast.diceResult !== "function") {
        return;
      }

      toast.diceResult({
        title: toastPayload.title,
        message: toastPayload.message,
        duration: DEFAULT_DICE_RESULT_DURATION_MS,
      });
      emittedMap.set(dedupeKey, now);
      while (emittedMap.size > MAX_PENDING_TOASTS) {
        const oldestKey = emittedMap.keys().next().value;
        if (!oldestKey) {
          break;
        }
        emittedMap.delete(oldestKey);
      }
    },
    [toast],
  );

  useEffect(() => {
    emittedSessionRollEventIdsRef.current.clear();
    if (suppressedSessionRollEventIdsRef?.current instanceof Set) {
      suppressedSessionRollEventIdsRef.current.clear();
    }
  }, [sessionId, suppressedSessionRollEventIdsRef]);

  useEffect(() => {
    if (!Array.isArray(sessionEvents) || sessionEvents.length === 0) {
      return;
    }

    const emittedSessionRollEventIds = emittedSessionRollEventIdsRef.current;
    const suppressedSessionRollEventIds =
      suppressedSessionRollEventIdsRef?.current instanceof Set
        ? suppressedSessionRollEventIdsRef.current
        : null;

    for (const event of sessionEvents) {
      const eventId = normalizeSessionEventId(event?.id);
      if (eventId === null || emittedSessionRollEventIds.has(eventId)) {
        continue;
      }

      emittedSessionRollEventIds.add(eventId);
      while (emittedSessionRollEventIds.size > MAX_TRACKED_SESSION_ROLL_TOAST_EVENTS) {
        const oldestEventId = emittedSessionRollEventIds.values().next().value;
        if (typeof oldestEventId === "undefined") {
          break;
        }
        emittedSessionRollEventIds.delete(oldestEventId);
      }

      if (suppressedSessionRollEventIds?.has(eventId)) {
        suppressedSessionRollEventIds.delete(eventId);
        continue;
      }

      const eventType = normalizeSessionEventType(event?.type);
      if (eventType !== "roll" && eventType !== "push") {
        continue;
      }

      if (isSessionRollEventFromSelf(event, sessionSelfTokenId, sessionSelfDisplayName)) {
        continue;
      }

      const payload =
        event && typeof event.payload === "object" && event.payload
          ? event.payload
          : {};
      const actorTokenId = normalizeSessionEventId(event?.actor?.token_id);

      emitRollToastEvent({
        eventId: `session-event-${eventId}`,
        source: "remote",
        actorId: actorTokenId === null ? "" : String(actorTokenId),
        actorName: normalizeSessionEventActorLabel(event),
        action: eventType,
        successes: normalizeSessionEventCount(payload.successes),
        banes: normalizeSessionEventCount(payload.banes),
        hasStrain: normalizeSessionEventHasStrain(payload),
      });
    }
  }, [
    emitRollToastEvent,
    sessionEvents,
    sessionSelfDisplayName,
    sessionSelfTokenId,
    suppressedSessionRollEventIdsRef,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const bridgeHandler = (eventPayload) => {
      emitRollToastEvent({
        ...eventPayload,
        source: "remote",
      });
    };

    window[REMOTE_ROLL_EVENT_BRIDGE_KEY] = bridgeHandler;

    return () => {
      if (window[REMOTE_ROLL_EVENT_BRIDGE_KEY] === bridgeHandler) {
        delete window[REMOTE_ROLL_EVENT_BRIDGE_KEY];
      }
    };
  }, [emitRollToastEvent]);

  return {
    emitRollToastEvent,
  };
};

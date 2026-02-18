export const normalizeToastDuration = (value, fallbackMs) => {
  const duration = Number.isFinite(value) ? value : fallbackMs;
  return duration > 0 ? duration : null;
};

export const createToastId = (idRef) => {
  if (!idRef || typeof idRef !== "object") {
    return null;
  }

  const currentValue = Number.isFinite(idRef.current) ? idRef.current : 0;
  idRef.current = currentValue + 1;
  return `toast-${currentValue}`;
};

/**
 * Shared helper for timed toast enqueue behavior.
 * Creates id, normalizes duration, inserts toast into queue, and registers timer.
 *
 * @param {{
 *   payload?: object,
 *   defaultDurationMs: number,
 *   idRef: { current: number },
 *   setToasts: (updater: (prev: Array<object>) => Array<object>) => void,
 *   timersRef: { current: Map<string, unknown> },
 *   removeToast: (toastId: string) => void,
 *   createEntry: (params: {
 *     id: string,
 *     payload: object,
 *     durationMs: number | null,
 *   }) => object | null,
 *   scheduleTimeout?: (callback: () => void, durationMs: number) => unknown,
 * }} options
 * @returns {string | null}
 */
export const enqueueTimedToast = ({
  payload = {},
  defaultDurationMs,
  idRef,
  setToasts,
  timersRef,
  removeToast,
  createEntry,
  scheduleTimeout = setTimeout,
}) => {
  if (typeof setToasts !== "function" || typeof createEntry !== "function") {
    return null;
  }

  const id = createToastId(idRef);
  if (!id) {
    return null;
  }

  const safePayload =
    payload && typeof payload === "object" ? payload : {};
  const durationMs = normalizeToastDuration(
    safePayload.duration,
    defaultDurationMs,
  );
  const entry = createEntry({ id, payload: safePayload, durationMs });

  if (!entry || typeof entry !== "object") {
    return null;
  }

  setToasts((prev) => [...prev, entry]);

  if (durationMs && typeof scheduleTimeout === "function") {
    const timeoutId = scheduleTimeout(() => removeToast(id), durationMs);
    if (timersRef?.current instanceof Map) {
      timersRef.current.set(id, timeoutId);
    }
  }

  return id;
};


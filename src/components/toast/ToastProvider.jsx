import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import ToastContainer from "./ToastContainer.jsx";
import {
  DEFAULT_DICE_RESULT_DURATION_MS,
  DEFAULT_TOAST_DURATION_MS,
  TOAST_KIND,
  TOAST_TONE,
  isValidToastTone,
} from "./constants.js";
import { createToastId, enqueueTimedToast } from "./enqueue-timed-toast.js";

export const ToastContext = createContext(null);

const parseAlertPayload = (options) => {
  if (typeof options === "string") {
    return { message: options };
  }

  return options && typeof options === "object" ? options : {};
};

const parseDiceResultPayload = (options) => {
  return options && typeof options === "object" ? options : {};
};

const parseConfirmPayload = (options) => {
  if (typeof options === "string") {
    return { message: options };
  }

  return options && typeof options === "object" ? options : {};
};

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const onDismissMapRef = useRef(new Map());
  const confirmQueueRef = useRef([]);
  const confirmActiveRef = useRef(null);
  const idRef = useRef(0);

  const removeToast = useCallback((toastId) => {
    if (typeof toastId !== "string" || !toastId) {
      return;
    }

    const onDismiss = onDismissMapRef.current.get(toastId);
    onDismissMapRef.current.delete(toastId);

    const timeoutId = timersRef.current.get(toastId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timersRef.current.delete(toastId);
    }

    setToasts((prev) => prev.filter((toast) => toast?.id !== toastId));

    if (typeof onDismiss === "function") {
      onDismiss();
    }
  }, []);

  const clearConfirmToast = useCallback((toastId) => {
    if (typeof toastId !== "string" || !toastId) {
      return;
    }

    setToasts((prev) => prev.filter((toast) => toast?.id !== toastId));
  }, []);

  const showNextConfirm = useCallback(() => {
    if (confirmActiveRef.current || confirmQueueRef.current.length === 0) {
      return;
    }

    const nextItem = confirmQueueRef.current.shift();
    if (!nextItem) {
      return;
    }

    const payload = parseConfirmPayload(nextItem.options);
    const id = createToastId(idRef);
    if (!id) {
      if (typeof nextItem.resolve === "function") {
        nextItem.resolve(false);
      }
      return;
    }

    const title = typeof payload.title === "string" ? payload.title : "Confirm";
    const message =
      typeof payload.message === "string" ? payload.message : "";
    const confirmLabel =
      typeof payload.confirmLabel === "string" ? payload.confirmLabel : "Confirm";
    const cancelLabel =
      typeof payload.cancelLabel === "string" ? payload.cancelLabel : "Cancel";
    const tone = isValidToastTone(payload.tone)
      ? payload.tone
      : TOAST_TONE.WARNING;

    confirmActiveRef.current = {
      resolve: nextItem.resolve,
      toastId: id,
    };

    setToasts((prev) => [
      ...prev,
      {
        id,
        kind: TOAST_KIND.CONFIRM,
        title,
        message,
        tone,
        confirmLabel,
        cancelLabel,
      },
    ]);
  }, []);

  const resolveConfirm = useCallback(
    (didConfirm) => {
      const active = confirmActiveRef.current;
      if (!active) {
        return;
      }

      confirmActiveRef.current = null;
      if (active.toastId) {
        clearConfirmToast(active.toastId);
      }
      if (typeof active.resolve === "function") {
        active.resolve(Boolean(didConfirm));
      }
      showNextConfirm();
    },
    [clearConfirmToast, showNextConfirm],
  );

  const handleConfirmChoice = useCallback(
    (toastId, didConfirm) => {
      const active = confirmActiveRef.current;
      if (!active || active.toastId !== toastId) {
        return;
      }

      resolveConfirm(didConfirm);
    },
    [resolveConfirm],
  );

  useEffect(() => {
    const timers = timersRef.current;
    const onDismissMap = onDismissMapRef.current;
    const confirmQueue = confirmQueueRef.current;
    
    return () => {
      timers.forEach((timeoutId) => clearTimeout(timeoutId));
      timers.clear();
      onDismissMap.clear();

      const activeConfirm = confirmActiveRef.current;
      confirmActiveRef.current = null;
      if (activeConfirm && typeof activeConfirm.resolve === "function") {
        activeConfirm.resolve(false);
      }

      const pendingConfirms = confirmQueue.splice(
        0,
        confirmQueue.length,
      );
      pendingConfirms.forEach((item) => {
        if (typeof item.resolve === "function") {
          item.resolve(false);
        }
      });
    };
  }, []);

  const alert = useCallback(
    (options) => {
      const payload = parseAlertPayload(options);
      return enqueueTimedToast({
        payload,
        defaultDurationMs: DEFAULT_TOAST_DURATION_MS,
        idRef,
        setToasts,
        timersRef,
        removeToast,
        createEntry: ({ id, payload: safePayload, durationMs }) => {
          const title =
            typeof safePayload.title === "string" ? safePayload.title : "";
          const message =
            typeof safePayload.message === "string" ? safePayload.message : "";
          if (!title && !message) {
            return null;
          }

          const tone = isValidToastTone(safePayload.tone)
            ? safePayload.tone
            : TOAST_TONE.INFO;
          const onDismiss =
            typeof safePayload.onDismiss === "function"
              ? safePayload.onDismiss
              : null;

          if (onDismiss) {
            onDismissMapRef.current.set(id, onDismiss);
          } else {
            onDismissMapRef.current.delete(id);
          }

          return {
            id,
            kind: TOAST_KIND.ALERT,
            title,
            message,
            tone,
            duration: durationMs,
          };
        },
      });
    },
    [removeToast],
  );

  const diceResult = useCallback(
    (options) => {
      const payload = parseDiceResultPayload(options);
      return enqueueTimedToast({
        payload,
        defaultDurationMs: DEFAULT_DICE_RESULT_DURATION_MS,
        idRef,
        setToasts,
        timersRef,
        removeToast,
        createEntry: ({ id, payload: safePayload, durationMs }) => {
          const title =
            typeof safePayload.title === "string" ? safePayload.title : "";
          const message =
            typeof safePayload.message === "string" ? safePayload.message : "";
          const breakdown =
            typeof safePayload.breakdown === "string"
              ? safePayload.breakdown
              : "";
          const total =
            typeof safePayload.total === "string" ? safePayload.total : "";
          if (!title && !message && !breakdown && !total) {
            return null;
          }

          const onDismiss =
            typeof safePayload.onDismiss === "function"
              ? safePayload.onDismiss
              : null;

          if (onDismiss) {
            onDismissMapRef.current.set(id, onDismiss);
          } else {
            onDismissMapRef.current.delete(id);
          }

          return {
            id,
            kind: TOAST_KIND.DICE_RESULT,
            title,
            message,
            breakdown,
            total,
            duration: durationMs,
          };
        },
      });
    },
    [removeToast],
  );

  const value = useMemo(
    () => ({
      alert,
      confirm: (options) =>
        new Promise((resolve) => {
          confirmQueueRef.current.push({ options, resolve });
          showNextConfirm();
        }),
      diceResult,
    }),
    [alert, diceResult, showNextConfirm],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer
        toasts={toasts}
        onDismiss={removeToast}
        onConfirmChoice={handleConfirmChoice}
      />
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ToastProvider;

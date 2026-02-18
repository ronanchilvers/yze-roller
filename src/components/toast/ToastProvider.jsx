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
import { enqueueTimedToast } from "./enqueue-timed-toast.js";

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

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const onDismissMapRef = useRef(new Map());
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

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timersRef.current.clear();
      onDismissMapRef.current.clear();
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
          const breakdown =
            typeof safePayload.breakdown === "string"
              ? safePayload.breakdown
              : "";
          const total =
            typeof safePayload.total === "string" ? safePayload.total : "";
          if (!breakdown && !total) {
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
      diceResult,
    }),
    [alert, diceResult],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ToastProvider;


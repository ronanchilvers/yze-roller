import { useLayoutEffect, useRef } from "react";
import PropTypes from "prop-types";
import { TOAST_KIND } from "./constants.js";
import "./Toast.css";

function ToastContainer({ toasts = [], onDismiss, onConfirmChoice }) {
  const safeToasts = Array.isArray(toasts) ? toasts : [];
  const resolveToastId = (toast, index, prefix = "toast") =>
    typeof toast?.id === "string" && toast.id ? toast.id : `${prefix}-${index}`;
  const confirmToasts = safeToasts
    .filter((toast) => toast?.kind === TOAST_KIND.CONFIRM)
    .map((toast, index) => ({
      toast,
      toastId: resolveToastId(toast, index, "confirm"),
    }));
  const regularToasts = safeToasts
    .filter((toast) => toast?.kind !== TOAST_KIND.CONFIRM)
    .map((toast, index) => ({
      toast,
      toastId: resolveToastId(toast, index),
    }));
  const toastNodeMapRef = useRef(new Map());
  const toastPositionMapRef = useRef(new Map());

  useLayoutEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      return;
    }

    const nodeMap = toastNodeMapRef.current;
    const previousPositions = toastPositionMapRef.current;
    const nextPositions = new Map();

    regularToasts.forEach(({ toastId }) => {
      const node = nodeMap.get(toastId);
      if (!node) {
        return;
      }

      const nextTop = node.getBoundingClientRect().top;
      nextPositions.set(toastId, nextTop);
      const previousTop = previousPositions.get(toastId);
      if (!Number.isFinite(previousTop)) {
        return;
      }

      const deltaY = previousTop - nextTop;
      if (Math.abs(deltaY) < 1) {
        return;
      }

      node.style.transition = "none";
      node.style.transform = `translateY(${deltaY}px)`;
      node.getBoundingClientRect();
      node.style.transition = "transform 220ms ease-out";
      node.style.transform = "";
    });

    toastPositionMapRef.current = nextPositions;
  }, [regularToasts]);

  const setToastNode = (toastId, node) => {
    if (!toastId) {
      return;
    }
    if (node) {
      toastNodeMapRef.current.set(toastId, node);
    } else {
      toastNodeMapRef.current.delete(toastId);
    }
  };

  const dismissLabelNumber = (index) => index + 1;

  const confirmToastsCount = confirmToasts.length;

  const hasSafeToasts = safeToasts.length > 0;

  if (!hasSafeToasts) {
    return null;
  }

  return (
    <>
      {confirmToastsCount > 0 ? (
        <div className="toast-overlay" role="presentation">
          <div className="toast-confirm-viewport">
            {confirmToasts.map(({ toast, toastId }) => {
              const titleId = `toast-confirm-title-${toastId}`;
              const messageId = `toast-confirm-message-${toastId}`;
              return (
                <div
                  key={toastId}
                  className="toast-item toast-confirm-item"
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby={toast?.title ? titleId : undefined}
                  aria-describedby={toast?.message ? messageId : undefined}
                  data-kind={toast?.kind ?? ""}
                >
                  {toast?.title ? (
                    <div id={titleId} className="toast-title">
                      {toast.title}
                    </div>
                  ) : null}
                  {toast?.message ? (
                    <div id={messageId} className="toast-message">
                      {toast.message}
                    </div>
                  ) : null}
                  <div
                    className="toast-confirm-actions"
                    role="group"
                    aria-label="Confirmation"
                  >
                    <button
                      type="button"
                      className="toast-confirm-cancel"
                      onClick={() => {
                        if (typeof onConfirmChoice === "function") {
                          onConfirmChoice(toastId, false);
                        }
                      }}
                    >
                      {toast?.cancelLabel ?? "Cancel"}
                    </button>
                    <button
                      type="button"
                      className="toast-confirm-accept"
                      autoFocus
                      onClick={() => {
                        if (typeof onConfirmChoice === "function") {
                          onConfirmChoice(toastId, true);
                        }
                      }}
                    >
                      {toast?.confirmLabel ?? "Confirm"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div
        className="toast-viewport"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Notifications"
      >
        {regularToasts.map(({ toast, toastId }, index) => {
          const isDiceResult = toast?.kind === TOAST_KIND.DICE_RESULT;
          const toastDuration =
            Number.isFinite(toast?.duration) && toast.duration > 0
              ? toast.duration
              : null;
          const diceResultText =
            typeof toast?.message === "string" && toast.message
              ? toast.message
              : typeof toast?.breakdown === "string"
                ? toast.breakdown
                : "";
          return (
            <div
              key={toastId}
              className="toast-item"
              role="status"
              data-kind={toast?.kind ?? ""}
              ref={(node) => setToastNode(toastId, node)}
            >
              {toast?.title ? <div className="toast-title">{toast.title}</div> : null}
              {isDiceResult ? (
                <div className="toast-result-text">{diceResultText}</div>
              ) : (
                <>
                  {toast?.message ? (
                    <div className="toast-message">{toast.message}</div>
                  ) : null}
                  {toast?.breakdown ? (
                    <div className="toast-breakdown">{toast.breakdown}</div>
                  ) : null}
                  {toast?.total ? <div className="toast-total">{toast.total}</div> : null}
                </>
              )}
              <button
                type="button"
                className="toast-dismiss-button"
                aria-label={`Dismiss notification ${dismissLabelNumber(index)}`}
                onClick={() => {
                  if (typeof onDismiss === "function") {
                    onDismiss(toastId);
                  }
                }}
              >
                Dismiss
              </button>
              {toastDuration ? (
                <div
                  className="toast-progress-bar"
                  style={{ animationDuration: `${toastDuration}ms` }}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

ToastContainer.propTypes = {
  toasts: PropTypes.arrayOf(PropTypes.object),
  onDismiss: PropTypes.func,
  onConfirmChoice: PropTypes.func,
};

export default ToastContainer;

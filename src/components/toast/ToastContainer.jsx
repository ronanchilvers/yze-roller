import PropTypes from "prop-types";
import { TOAST_KIND } from "./constants.js";
import "./Toast.css";

function ToastContainer({ toasts = [], onDismiss, onConfirmChoice }) {
  const safeToasts = Array.isArray(toasts) ? toasts : [];
  const confirmToasts = safeToasts.filter(
    (toast) => toast?.kind === TOAST_KIND.CONFIRM,
  );
  const regularToasts = safeToasts.filter(
    (toast) => toast?.kind !== TOAST_KIND.CONFIRM,
  );

  if (safeToasts.length === 0) {
    return null;
  }

  return (
    <>
      {confirmToasts.length > 0 ? (
        <div className="toast-overlay" role="presentation">
          <div className="toast-confirm-viewport">
            {confirmToasts.map((toast, index) => {
              const toastId =
                typeof toast?.id === "string" && toast.id
                  ? toast.id
                  : `confirm-${index}`;
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
        {regularToasts.map((toast, index) => {
          const toastId =
            typeof toast?.id === "string" && toast.id
              ? toast.id
              : `toast-${index}`;
          return (
            <div
              key={toastId}
              className="toast-item"
              role="status"
              data-kind={toast?.kind ?? ""}
            >
              {toast?.title ? <div className="toast-title">{toast.title}</div> : null}
              {toast?.message ? (
                <div className="toast-message">{toast.message}</div>
              ) : null}
              {toast?.breakdown ? (
                <div className="toast-breakdown">{toast.breakdown}</div>
              ) : null}
              {toast?.total ? <div className="toast-total">{toast.total}</div> : null}
              <button
                type="button"
                className="toast-dismiss-button"
                aria-label={`Dismiss notification ${index + 1}`}
                onClick={() => {
                  if (typeof onDismiss === "function") {
                    onDismiss(toastId);
                  }
                }}
              >
                Dismiss
              </button>
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

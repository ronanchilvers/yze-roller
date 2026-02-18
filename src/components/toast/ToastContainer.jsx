import PropTypes from "prop-types";
import { TOAST_KIND } from "./constants.js";

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
        <div className="toast-confirm-viewport">
          {confirmToasts.map((toast, index) => {
            const toastId =
              typeof toast?.id === "string" && toast.id
                ? toast.id
                : `confirm-${index}`;
            return (
              <div
                key={toastId}
                className="toast-item toast-confirm-item"
                role="alertdialog"
                aria-modal="true"
                data-kind={toast?.kind ?? ""}
              >
                {toast?.title ? (
                  <div className="toast-title">{toast.title}</div>
                ) : null}
                {toast?.message ? (
                  <div className="toast-message">{toast.message}</div>
                ) : null}
                <div className="toast-confirm-actions">
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
      ) : null}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
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

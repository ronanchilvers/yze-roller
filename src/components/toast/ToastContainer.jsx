import PropTypes from "prop-types";

function ToastContainer({ toasts, onDismiss }) {
  const safeToasts = Array.isArray(toasts) ? toasts : [];

  if (safeToasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {safeToasts.map((toast, index) => {
        const toastId =
          typeof toast?.id === "string" && toast.id ? toast.id : `toast-${index}`;
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
  );
}

ToastContainer.propTypes = {
  toasts: PropTypes.arrayOf(PropTypes.object),
  onDismiss: PropTypes.func,
};

ToastContainer.defaultProps = {
  toasts: [],
  onDismiss: undefined,
};

export default ToastContainer;

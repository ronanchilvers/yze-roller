// @vitest-environment jsdom
import { useContext } from "react";
import PropTypes from "prop-types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import ToastProvider, { ToastContext } from "./ToastProvider.jsx";
import { TOAST_KIND } from "./constants.js";

const createContainer = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    root,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const getButtonByText = (container, text) =>
  Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === text,
  );

const TriggerToast = ({ method, options = undefined, onResult = undefined }) => {
  const toast = useContext(ToastContext);

  return (
    <button
      type="button"
      onClick={() => {
        if (!toast) {
          return;
        }

        const value = toast[method](options);
        if (typeof onResult === "function") {
          onResult(value);
        }
      }}
    >
      Trigger
    </button>
  );
};

TriggerToast.propTypes = {
  method: PropTypes.string.isRequired,
  options: PropTypes.any,
  onResult: PropTypes.func,
};

const TriggerConfirm = ({ options = undefined, onResolved = undefined }) => {
  const toast = useContext(ToastContext);

  return (
    <button
      type="button"
      onClick={() => {
        if (!toast || typeof toast.confirm !== "function") {
          return;
        }

        void toast.confirm(options).then((value) => {
          if (typeof onResolved === "function") {
            onResolved(value);
          }
        });
      }}
    >
      Ask
    </button>
  );
};

TriggerConfirm.propTypes = {
  options: PropTypes.any,
  onResolved: PropTypes.func,
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

test("alert creates an alert toast and returns an id", () => {
  const onResult = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerToast
          method="alert"
          options={{
            title: "Saved",
            message: "Changes stored",
            duration: 0,
          }}
          onResult={onResult}
        />
      </ToastProvider>,
    );
  });

  const trigger = getButtonByText(container, "Trigger");
  act(() => {
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const toastNode = container.querySelector(".toast-item");
  expect(toastNode).not.toBeNull();
  expect(toastNode.textContent).toContain("Saved");
  expect(toastNode.textContent).toContain("Changes stored");

  expect(onResult).toHaveBeenCalledTimes(1);
  const toastId = onResult.mock.calls[0][0];
  expect(typeof toastId).toBe("string");
  expect(toastId).toMatch(/^toast-\d+$/);

  unmount();
});

test("diceResult creates a dice result toast", () => {
  const onResult = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerToast
          method="diceResult"
          options={{
            breakdown: "2 successes, 1 bane",
            total: "+1",
            duration: 0,
          }}
          onResult={onResult}
        />
      </ToastProvider>,
    );
  });

  const trigger = getButtonByText(container, "Trigger");
  act(() => {
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const toastNode = container.querySelector(".toast-item");
  expect(toastNode).not.toBeNull();
  expect(toastNode.textContent).toContain("2 successes, 1 bane");
  expect(toastNode.textContent).not.toContain("+1");
  expect(onResult).toHaveBeenCalledTimes(1);

  unmount();
});

test("diceResult supports title/message payload for remote actor context", () => {
  const onResult = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerToast
          method="diceResult"
          options={{
            title: "Watcher pushed",
            message: "3 successes, 2 banes (with Strain)",
            duration: 0,
          }}
          onResult={onResult}
        />
      </ToastProvider>,
    );
  });

  const trigger = getButtonByText(container, "Trigger");
  act(() => {
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const toastNode = container.querySelector(".toast-item");
  expect(toastNode).not.toBeNull();
  expect(toastNode?.getAttribute("data-kind")).toBe(TOAST_KIND.DICE_RESULT);
  expect(toastNode?.textContent).toContain("Watcher pushed");
  expect(toastNode?.textContent).toContain("3 successes, 2 banes (with Strain)");
  expect(onResult).toHaveBeenCalledTimes(1);

  unmount();
});

test("auto-dismisses timed toast and calls onDismiss callback", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerToast
          method="alert"
          options={{
            title: "Auto",
            message: "Will close",
            duration: 1500,
            onDismiss,
          }}
        />
      </ToastProvider>,
    );
  });

  const trigger = getButtonByText(container, "Trigger");
  act(() => {
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.querySelector(".toast-item")).not.toBeNull();

  act(() => {
    vi.advanceTimersByTime(1500);
  });

  expect(container.querySelector(".toast-item")).toBeNull();
  expect(onDismiss).toHaveBeenCalledTimes(1);

  unmount();
});

test("manual dismiss removes toast and calls onDismiss callback", () => {
  const onDismiss = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerToast
          method="alert"
          options={{
            title: "Manual",
            message: "Dismiss me",
            duration: 0,
            onDismiss,
          }}
        />
      </ToastProvider>,
    );
  });

  const trigger = getButtonByText(container, "Trigger");
  act(() => {
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const dismiss = getButtonByText(container, "Dismiss");
  act(() => {
    dismiss.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.querySelector(".toast-item")).toBeNull();
  expect(onDismiss).toHaveBeenCalledTimes(1);

  unmount();
});

test("ignores invalid alert and diceResult payloads", () => {
  const onAlert = vi.fn();
  const onDice = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerToast method="alert" options={{}} onResult={onAlert} />
        <TriggerToast method="diceResult" options={{}} onResult={onDice} />
      </ToastProvider>,
    );
  });

  const triggers = Array.from(container.querySelectorAll("button")).filter(
    (button) => button.textContent?.trim() === "Trigger",
  );

  act(() => {
    triggers[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    triggers[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onAlert).toHaveBeenCalledWith(null);
  expect(onDice).toHaveBeenCalledWith(null);
  expect(container.querySelector(".toast-item")).toBeNull();

  unmount();
});

test("alert toasts are tagged with the alert kind constant", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerToast
          method="alert"
          options={{ message: "Kind check", duration: 0 }}
        />
      </ToastProvider>,
    );
  });

  const trigger = getButtonByText(container, "Trigger");
  act(() => {
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const toastNode = container.querySelector(".toast-item");
  expect(toastNode).not.toBeNull();
  expect(toastNode?.getAttribute("data-kind")).toBe(TOAST_KIND.ALERT);

  unmount();
});

test("confirm resolves true when accept is clicked", async () => {
  const onResolved = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerConfirm
          options={{
            title: "Delete",
            message: "Are you sure?",
            confirmLabel: "Proceed",
            cancelLabel: "Back",
          }}
          onResolved={onResolved}
        />
      </ToastProvider>,
    );
  });

  const ask = getButtonByText(container, "Ask");
  act(() => {
    ask.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(getButtonByText(container, "Proceed")).not.toBeUndefined();

  const proceed = getButtonByText(container, "Proceed");
  act(() => {
    proceed.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  await act(async () => {});

  expect(onResolved).toHaveBeenCalledWith(true);
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();

  unmount();
});

test("confirm resolves false when cancel is clicked", async () => {
  const onResolved = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerConfirm
          options={{
            title: "Reset",
            message: "Cancel?",
            confirmLabel: "OK",
            cancelLabel: "No",
          }}
          onResolved={onResolved}
        />
      </ToastProvider>,
    );
  });

  const ask = getButtonByText(container, "Ask");
  act(() => {
    ask.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const cancel = getButtonByText(container, "No");
  act(() => {
    cancel.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  await act(async () => {});

  expect(onResolved).toHaveBeenCalledWith(false);
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();

  unmount();
});

test("confirm queue shows one dialog at a time and resolves in order", async () => {
  const firstResolved = vi.fn();
  const secondResolved = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <ToastProvider>
        <TriggerConfirm
          options={{
            title: "First",
            message: "Confirm first?",
            confirmLabel: "Yes First",
            cancelLabel: "No First",
          }}
          onResolved={firstResolved}
        />
        <TriggerConfirm
          options={{
            title: "Second",
            message: "Confirm second?",
            confirmLabel: "Yes Second",
            cancelLabel: "No Second",
          }}
          onResolved={secondResolved}
        />
      </ToastProvider>,
    );
  });

  const askButtons = Array.from(container.querySelectorAll("button")).filter(
    (button) => button.textContent?.trim() === "Ask",
  );

  act(() => {
    askButtons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    askButtons[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.textContent).toContain("Confirm first?");
  expect(container.textContent).not.toContain("Confirm second?");

  const firstConfirm = getButtonByText(container, "Yes First");
  act(() => {
    firstConfirm.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  await act(async () => {});

  expect(firstResolved).toHaveBeenCalledWith(true);
  expect(container.textContent).toContain("Confirm second?");

  const secondCancel = getButtonByText(container, "No Second");
  act(() => {
    secondCancel.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  await act(async () => {});

  expect(secondResolved).toHaveBeenCalledWith(false);
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();

  unmount();
});

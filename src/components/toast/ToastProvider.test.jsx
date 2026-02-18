// @vitest-environment jsdom
import { useContext } from "react";
import PropTypes from "prop-types";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
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

const TriggerToast = ({ method, options, onResult }) => {
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

TriggerToast.defaultProps = {
  options: undefined,
  onResult: undefined,
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
  expect(toastNode.textContent).toContain("+1");
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

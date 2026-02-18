// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import ToastContainer from "./ToastContainer.jsx";
import { TOAST_KIND } from "./constants.js";

const createContainer = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    root,
    render(ui) {
      act(() => {
        root.render(ui);
      });
    },
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

test("renders dismiss button for regular toast and calls onDismiss", () => {
  const onDismiss = vi.fn();
  const app = createContainer();

  app.render(
    <ToastContainer
      toasts={[
        {
          id: "a1",
          kind: TOAST_KIND.ALERT,
          title: "Saved",
          message: "All changes saved.",
        },
      ]}
      onDismiss={onDismiss}
    />,
  );

  const dismissButton = getButtonByText(app.container, "Dismiss");
  expect(dismissButton).not.toBeUndefined();

  act(() => {
    dismissButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onDismiss).toHaveBeenCalledWith("a1");
  app.unmount();
});

test("renders confirm toast labels from payload and calls onConfirmChoice", () => {
  const onConfirmChoice = vi.fn();
  const app = createContainer();

  app.render(
    <ToastContainer
      toasts={[
        {
          id: "c1",
          kind: TOAST_KIND.CONFIRM,
          title: "Delete",
          message: "Delete this item?",
          confirmLabel: "Proceed",
          cancelLabel: "Keep",
        },
      ]}
      onConfirmChoice={onConfirmChoice}
    />,
  );

  expect(app.container.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(getButtonByText(app.container, "Proceed")).not.toBeUndefined();
  expect(getButtonByText(app.container, "Keep")).not.toBeUndefined();

  act(() => {
    getButtonByText(app.container, "Keep").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  });
  expect(onConfirmChoice).toHaveBeenCalledWith("c1", false);

  act(() => {
    getButtonByText(app.container, "Proceed").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  });
  expect(onConfirmChoice).toHaveBeenCalledWith("c1", true);

  app.unmount();
});

test("returns null for invalid toast collections", () => {
  const app = createContainer();
  app.render(<ToastContainer toasts={null} />);
  expect(app.container.querySelector(".toast-viewport")).toBeNull();
  expect(app.container.querySelector(".toast-overlay")).toBeNull();
  app.unmount();
});


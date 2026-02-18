// @vitest-environment jsdom
import { useEffect } from "react";
import PropTypes from "prop-types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import ToastProvider from "../components/toast/ToastProvider.jsx";
import {
  __IS_DEV_USE_TOAST,
  __resetUseToastWarningForTests,
  useToast,
} from "./useToast.js";

const createContainer = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    root,
    render(node) {
      act(() => {
        root.render(node);
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

const CaptureToast = ({ onCapture }) => {
  const toast = useToast();

  useEffect(() => {
    onCapture(toast);
  }, [onCapture, toast]);

  return null;
};

CaptureToast.propTypes = {
  onCapture: PropTypes.func.isRequired,
};

afterEach(() => {
  document.body.innerHTML = "";
  __resetUseToastWarningForTests();
  vi.restoreAllMocks();
});

test("returns fallback handlers when provider is missing", async () => {
  let captured;
  const app = createContainer();

  app.render(
    <CaptureToast
      onCapture={(toast) => {
        captured = toast;
      }}
    />,
  );

  expect(captured).toBeDefined();
  expect(captured.alert()).toBeNull();
  expect(captured.diceResult()).toBeNull();
  await expect(captured.confirm()).resolves.toBe(false);

  app.unmount();
});

test("warns once when missing provider in development", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  const app1 = createContainer();
  app1.render(<CaptureToast onCapture={() => {}} />);
  app1.unmount();

  const app2 = createContainer();
  app2.render(<CaptureToast onCapture={() => {}} />);
  app2.unmount();

  expect(warnSpy).toHaveBeenCalledTimes(__IS_DEV_USE_TOAST ? 1 : 0);
});

test("returns provider handlers when wrapped with ToastProvider", () => {
  let captured;
  const app = createContainer();

  app.render(
    <ToastProvider>
      <CaptureToast
        onCapture={(toast) => {
          captured = toast;
        }}
      />
    </ToastProvider>,
  );

  expect(captured).toBeDefined();
  const id = captured.alert({ message: "Hello", duration: 0 });
  expect(typeof id).toBe("string");
  expect(id).toMatch(/^toast-\d+$/);
  expect(typeof captured.diceResult).toBe("function");
  expect(typeof captured.confirm).toBe("function");

  app.unmount();
});

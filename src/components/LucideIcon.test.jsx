// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { RotateCcw } from "lucide-react";
import { afterEach, expect, test } from "vitest";
import LucideIcon from "./LucideIcon.jsx";

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

afterEach(() => {
  document.body.innerHTML = "";
});

test("renders a lucide forwardRef icon in decorative mode", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<LucideIcon icon={RotateCcw} className="test-icon" />);
  });

  const icon = container.querySelector("svg.test-icon");

  expect(icon).not.toBeNull();
  expect(icon?.getAttribute("aria-hidden")).toBe("true");

  unmount();
});

test("renders labelled icon when decorative mode is disabled", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <LucideIcon icon={RotateCcw} decorative={false} label="Reset strain points icon" />,
    );
  });

  const icon = container.querySelector('svg[role="img"]');

  expect(icon).not.toBeNull();
  expect(icon?.getAttribute("aria-label")).toBe("Reset strain points icon");

  unmount();
});

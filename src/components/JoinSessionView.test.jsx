// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import JoinSessionView from "./JoinSessionView.jsx";

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
}));

vi.mock("../lib/api-client.js", () => ({
  apiPost: (...args) => mocks.apiPost(...args),
  isApiClientError: (error) =>
    Boolean(
      error &&
        typeof error === "object" &&
        error.name === "ApiClientError" &&
        typeof error.code === "string",
    ),
}));

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

afterEach(() => {
  mocks.apiPost.mockReset();
  document.body.innerHTML = "";
});

test("renders a blocking error state when join token is missing", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<JoinSessionView joinToken={null} />);
  });

  expect(container.textContent).toContain("Invalid join link");
  expect(container.querySelector("form")).toBeNull();
  expect(getButtonByText(container, "Back to app")).toBeDefined();

  unmount();
});

test("submits join request and emits normalized auth state on success", async () => {
  const onJoinSuccess = vi.fn();
  const { container, root, unmount } = createContainer();

  mocks.apiPost.mockResolvedValue({
    status: 201,
    data: {
      session_id: 7,
      player_token: " player-token-1 ",
      player: {
        token_id: 31,
        display_name: "Alice",
        role: "player",
      },
    },
  });

  act(() => {
    root.render(
      <JoinSessionView joinToken="join-token-1" onJoinSuccess={onJoinSuccess} />,
    );
  });

  const nameInput = container.querySelector("#displayName");
  const joinButton = getButtonByText(container, "Join session");

  act(() => {
    nameInput.value = "Alice";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    joinButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(mocks.apiPost).toHaveBeenCalledTimes(1);
  expect(mocks.apiPost).toHaveBeenCalledWith(
    "/join",
    { display_name: "Alice" },
    { token: "join-token-1" },
  );
  expect(onJoinSuccess).toHaveBeenCalledWith({
    sessionToken: "player-token-1",
    sessionId: 7,
    role: "player",
    self: {
      token_id: 31,
      display_name: "Alice",
      role: "player",
    },
  });

  unmount();
});

test("shows user-friendly error message when join request fails", async () => {
  const { container, root, unmount } = createContainer();

  mocks.apiPost.mockRejectedValue({
    name: "ApiClientError",
    code: "JOIN_DISABLED",
  });

  act(() => {
    root.render(<JoinSessionView joinToken="join-token-1" />);
  });

  const nameInput = container.querySelector("#displayName");
  const joinButton = getButtonByText(container, "Join session");

  act(() => {
    nameInput.value = "Alice";
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    joinButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.textContent).toContain(
    "Joining is currently disabled for this session.",
  );

  unmount();
});

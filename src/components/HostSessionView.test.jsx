// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import HostSessionView from "./HostSessionView.jsx";

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

afterEach(() => {
  mocks.apiPost.mockReset();
  document.body.innerHTML = "";
});

test("renders host game form", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<HostSessionView />);
  });

  expect(container.textContent).toContain("Host Game");
  expect(container.querySelector("#gmName")).not.toBeNull();
  expect(container.querySelector("#sessionName")).not.toBeNull();
  expect(container.querySelector("#inviteLinkInput")).not.toBeNull();
  expect(container.querySelector('button[type="submit"]')).not.toBeNull();

  unmount();
});

test("creates session and emits normalized gm auth state on success", async () => {
  const onHostSuccess = vi.fn();
  const { container, root, unmount } = createContainer();

  mocks.apiPost.mockResolvedValue({
    status: 201,
    data: {
      session_id: 7,
      gm_token: " gm-token-1 ",
      join_link: "https://example.com/join#join=abc",
    },
  });

  act(() => {
    root.render(<HostSessionView onHostSuccess={onHostSuccess} />);
  });

  const gmNameInput = container.querySelector("#gmName");
  const sessionNameInput = container.querySelector("#sessionName");
  const submitButton = container.querySelector('button[type="submit"]');

  act(() => {
    gmNameInput.value = " GM Nova ";
    gmNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  act(() => {
    sessionNameInput.value = "Streetwise Night";
    sessionNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(mocks.apiPost).toHaveBeenCalledWith("/sessions", {
    session_name: "Streetwise Night",
    display_name: "GM Nova",
  });
  expect(onHostSuccess).toHaveBeenCalledWith({
    sessionToken: "gm-token-1",
    sessionId: 7,
    role: "gm",
    self: null,
  });

  unmount();
});

test("shows mapped error when session creation fails", async () => {
  const { container, root, unmount } = createContainer();

  mocks.apiPost.mockRejectedValue({
    name: "ApiClientError",
    code: "VALIDATION_ERROR",
  });

  act(() => {
    root.render(<HostSessionView />);
  });

  const sessionNameInput = container.querySelector("#sessionName");
  const submitButton = container.querySelector('button[type="submit"]');

  act(() => {
    const gmNameInput = container.querySelector("#gmName");
    gmNameInput.value = "GM Nova";
    gmNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  act(() => {
    sessionNameInput.value = "x";
    sessionNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.textContent).toContain(
    "Session name must be 1-128 chars and GM name must be 1-64 chars.",
  );

  unmount();
});

test("blocks submit when gm name is blank", async () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<HostSessionView />);
  });

  const sessionNameInput = container.querySelector("#sessionName");
  const submitButton = container.querySelector('button[type="submit"]');

  act(() => {
    sessionNameInput.value = "Streetwise Night";
    sessionNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => {
    submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(mocks.apiPost).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Enter a GM name to create a game.");

  unmount();
});

test("host mode invite-link entry emits parsed join token", () => {
  const onUseInviteLink = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<HostSessionView onUseInviteLink={onUseInviteLink} />);
  });

  const inviteLinkInput = container.querySelector("#inviteLinkInput");
  const inviteButton = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === "Use invite link",
  );

  act(() => {
    inviteLinkInput.value = "https://app.example.com/join#join=token-123";
    inviteLinkInput.dispatchEvent(new Event("input", { bubbles: true }));
  });

  act(() => {
    inviteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onUseInviteLink).toHaveBeenCalledWith("token-123");

  unmount();
});

// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ApiClientError } from "../lib/api-client.js";
import { useMultiplayerSession } from "./useMultiplayerSession.js";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  isApiClientError: vi.fn(),
  getSessionAuth: vi.fn(),
  clearSessionAuth: vi.fn(),
}));

vi.mock("../lib/api-client.js", async () => {
  const actual = await vi.importActual("../lib/api-client.js");

  return {
    ...actual,
    apiGet: (...args) => mocks.apiGet(...args),
    isApiClientError: (...args) => mocks.isApiClientError(...args),
  };
});

vi.mock("../lib/session-auth.js", () => ({
  getSessionAuth: (...args) => mocks.getSessionAuth(...args),
  clearSessionAuth: (...args) => mocks.clearSessionAuth(...args),
}));

const createContainer = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    root,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

function CaptureMultiplayerSession({ onCapture }) {
  const hookValue = useMultiplayerSession();

  useEffect(() => {
    onCapture(hookValue);
  }, [hookValue, onCapture]);

  return null;
}

afterEach(() => {
  mocks.apiGet.mockReset();
  mocks.isApiClientError.mockReset();
  mocks.getSessionAuth.mockReset();
  mocks.clearSessionAuth.mockReset();
  document.body.innerHTML = "";
});

test("bootstrapFromAuth is a no-op when no session token is present", async () => {
  mocks.getSessionAuth.mockReturnValue(null);
  mocks.isApiClientError.mockImplementation(
    (error) => error instanceof ApiClientError,
  );

  const capture = vi.fn();
  const app = createContainer();

  await act(async () => {
    app.root.render(<CaptureMultiplayerSession onCapture={capture} />);
  });

  const latest = capture.mock.calls.at(-1)?.[0];
  await act(async () => {
    await latest.bootstrapFromAuth();
  });

  expect(mocks.apiGet).not.toHaveBeenCalled();
  expect(capture.mock.calls.at(-1)?.[0].sessionState.status).toBe("idle");

  app.unmount();
});

test("bootstrapFromAuth stores normalized snapshot state on success", async () => {
  mocks.getSessionAuth.mockReturnValue({
    sessionToken: "player-token-1",
  });
  mocks.isApiClientError.mockImplementation(
    (error) => error instanceof ApiClientError,
  );
  mocks.apiGet.mockResolvedValue({
    status: 200,
    data: {
      session_id: 7,
      session_name: "Streetwise Night",
      joining_enabled: true,
      role: "player",
      self: {
        token_id: 31,
        display_name: "Alice",
        role: "player",
      },
      scene_strain: 3,
      latest_event_id: 130,
      players: [
        {
          token_id: 31,
          display_name: "Alice",
          role: "player",
        },
      ],
    },
  });

  const capture = vi.fn();
  const app = createContainer();

  await act(async () => {
    app.root.render(<CaptureMultiplayerSession onCapture={capture} />);
  });

  const latest = capture.mock.calls.at(-1)?.[0];
  await act(async () => {
    await latest.bootstrapFromAuth();
  });

  const finalState = capture.mock.calls.at(-1)?.[0].sessionState;

  expect(mocks.apiGet).toHaveBeenCalledWith("/session", {
    token: "player-token-1",
  });
  expect(finalState.status).toBe("ready");
  expect(finalState.sessionId).toBe(7);
  expect(finalState.sinceId).toBe(130);
  expect(finalState.role).toBe("player");
  expect(finalState.sceneStrain).toBe(3);

  app.unmount();
});

test("bootstrapFromAuth handles auth failures by clearing memory auth", async () => {
  const authError = new ApiClientError({
    status: 403,
    code: "TOKEN_REVOKED",
    message: "Session token revoked.",
  });

  mocks.getSessionAuth.mockReturnValue({
    sessionToken: "revoked-token",
  });
  mocks.isApiClientError.mockImplementation(
    (error) => error instanceof ApiClientError,
  );
  mocks.apiGet.mockRejectedValue(authError);

  const capture = vi.fn();
  const app = createContainer();

  await act(async () => {
    app.root.render(<CaptureMultiplayerSession onCapture={capture} />);
  });

  const latest = capture.mock.calls.at(-1)?.[0];
  await act(async () => {
    await latest.bootstrapFromAuth();
  });

  const finalState = capture.mock.calls.at(-1)?.[0].sessionState;

  expect(mocks.clearSessionAuth).toHaveBeenCalledTimes(1);
  expect(finalState.status).toBe("auth_lost");
  expect(finalState.errorCode).toBe("TOKEN_REVOKED");

  app.unmount();
});

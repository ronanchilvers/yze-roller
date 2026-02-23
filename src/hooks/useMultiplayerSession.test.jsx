// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ApiClientError } from "../lib/api-client.js";
import {
  DEFAULT_POLL_INTERVAL_MS,
  useMultiplayerSession,
} from "./useMultiplayerSession.js";

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

const getLatestHookValue = (capture) => capture.mock.calls.at(-1)?.[0];

const buildSessionSnapshot = (overrides = {}) => ({
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
  latest_event_id: 0,
  players: [],
  ...overrides,
});

afterEach(() => {
  mocks.apiGet.mockReset();
  mocks.isApiClientError.mockReset();
  mocks.getSessionAuth.mockReset();
  mocks.clearSessionAuth.mockReset();
  vi.clearAllTimers();
  vi.useRealTimers();
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

  await act(async () => {
    await getLatestHookValue(capture).bootstrapFromAuth();
  });

  expect(mocks.apiGet).not.toHaveBeenCalled();
  expect(getLatestHookValue(capture).sessionState.status).toBe("idle");

  app.unmount();
});

test("bootstrapFromAuth stores normalized snapshot state on success", async () => {
  vi.useFakeTimers();

  mocks.getSessionAuth.mockReturnValue({
    sessionToken: "player-token-1",
  });
  mocks.isApiClientError.mockImplementation(
    (error) => error instanceof ApiClientError,
  );
  mocks.apiGet.mockImplementation(async (path) => {
    if (path === "/session") {
      return {
        status: 200,
        data: buildSessionSnapshot({
          latest_event_id: 130,
        }),
      };
    }

    return {
      status: 204,
      data: null,
    };
  });

  const capture = vi.fn();
  const app = createContainer();

  await act(async () => {
    app.root.render(<CaptureMultiplayerSession onCapture={capture} />);
  });

  await act(async () => {
    await getLatestHookValue(capture).bootstrapFromAuth();
  });

  const finalState = getLatestHookValue(capture).sessionState;

  expect(mocks.apiGet).toHaveBeenCalledWith("/session", {
    token: "player-token-1",
  });
  expect(finalState.status).toBe("ready");
  expect(finalState.sessionId).toBe(7);
  expect(finalState.sinceId).toBe(130);
  expect(finalState.role).toBe("player");
  expect(finalState.sceneStrain).toBe(3);
  expect(finalState.pollingStatus).toBe("running");
  expect(finalState.pollIntervalMs).toBe(DEFAULT_POLL_INTERVAL_MS);

  app.unmount();
});

test("polling loop appends events and advances cursor on 200 responses", async () => {
  vi.useFakeTimers();

  mocks.getSessionAuth.mockReturnValue({
    sessionToken: "player-token-1",
  });
  mocks.isApiClientError.mockImplementation(
    (error) => error instanceof ApiClientError,
  );
  mocks.apiGet.mockImplementation(async (path) => {
    if (path === "/session") {
      return {
        status: 200,
        data: buildSessionSnapshot({
          latest_event_id: 10,
        }),
      };
    }

    if (path.includes("/events?since_id=10")) {
      return {
        status: 200,
        data: {
          events: [
            { id: 11, type: "roll", payload: { successes: 1, banes: 0 } },
            { id: 12, type: "push", payload: { successes: 2, banes: 1 } },
          ],
          next_since_id: 12,
        },
      };
    }

    return {
      status: 204,
      data: null,
    };
  });

  const capture = vi.fn();
  const app = createContainer();

  await act(async () => {
    app.root.render(<CaptureMultiplayerSession onCapture={capture} />);
  });

  await act(async () => {
    await getLatestHookValue(capture).bootstrapFromAuth();
  });

  await act(async () => {
    vi.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
  });

  const finalState = getLatestHookValue(capture).sessionState;

  expect(finalState.sinceId).toBe(12);
  expect(finalState.latestEventId).toBe(12);
  expect(finalState.events).toHaveLength(2);
  expect(finalState.pollIntervalMs).toBe(DEFAULT_POLL_INTERVAL_MS);
  expect(finalState.pollingStatus).toBe("running");

  app.unmount();
});

test("polling loop increases interval on 204 no-content responses", async () => {
  vi.useFakeTimers();

  mocks.getSessionAuth.mockReturnValue({
    sessionToken: "player-token-1",
  });
  mocks.isApiClientError.mockImplementation(
    (error) => error instanceof ApiClientError,
  );
  mocks.apiGet.mockImplementation(async (path) => {
    if (path === "/session") {
      return {
        status: 200,
        data: buildSessionSnapshot({
          latest_event_id: 0,
        }),
      };
    }

    return {
      status: 204,
      data: null,
    };
  });

  const capture = vi.fn();
  const app = createContainer();

  await act(async () => {
    app.root.render(<CaptureMultiplayerSession onCapture={capture} />);
  });

  await act(async () => {
    await getLatestHookValue(capture).bootstrapFromAuth();
  });

  await act(async () => {
    vi.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
  });

  const finalState = getLatestHookValue(capture).sessionState;

  expect(finalState.pollingStatus).toBe("backoff");
  expect(finalState.pollIntervalMs).toBe(1500);

  app.unmount();
});

test("polling loop uses exponential backoff on non-auth errors", async () => {
  vi.useFakeTimers();
  const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

  mocks.getSessionAuth.mockReturnValue({
    sessionToken: "player-token-1",
  });
  mocks.isApiClientError.mockImplementation(
    (error) => error instanceof ApiClientError,
  );
  mocks.apiGet.mockImplementation(async (path) => {
    if (path === "/session") {
      return {
        status: 200,
        data: buildSessionSnapshot({
          latest_event_id: 0,
        }),
      };
    }

    throw new Error("network down");
  });

  const capture = vi.fn();
  const app = createContainer();

  await act(async () => {
    app.root.render(<CaptureMultiplayerSession onCapture={capture} />);
  });

  await act(async () => {
    await getLatestHookValue(capture).bootstrapFromAuth();
  });

  await act(async () => {
    vi.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
  });

  const finalState = getLatestHookValue(capture).sessionState;

  expect(finalState.pollingStatus).toBe("backoff");
  expect(finalState.pollIntervalMs).toBe(2000);
  expect(finalState.errorCode).toBe("NETWORK_ERROR");

  randomSpy.mockRestore();
  app.unmount();
});

test("bootstrapFromAuth handles auth failures by clearing memory auth", async () => {
  vi.useFakeTimers();

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

  await act(async () => {
    await getLatestHookValue(capture).bootstrapFromAuth();
  });

  const finalState = getLatestHookValue(capture).sessionState;

  expect(mocks.clearSessionAuth).toHaveBeenCalledTimes(1);
  expect(finalState.status).toBe("auth_lost");
  expect(finalState.errorCode).toBe("TOKEN_REVOKED");
  expect(finalState.pollingStatus).toBe("stopped");

  app.unmount();
});

test("polling loop stops and clears auth on token failures", async () => {
  vi.useFakeTimers();

  mocks.getSessionAuth.mockReturnValue({
    sessionToken: "player-token-1",
  });
  mocks.isApiClientError.mockImplementation(
    (error) => error instanceof ApiClientError,
  );
  mocks.apiGet.mockImplementation(async (path) => {
    if (path === "/session") {
      return {
        status: 200,
        data: buildSessionSnapshot({
          latest_event_id: 0,
        }),
      };
    }

    throw new ApiClientError({
      status: 401,
      code: "TOKEN_INVALID",
      message: "Authorization token is invalid.",
    });
  });

  const capture = vi.fn();
  const app = createContainer();

  await act(async () => {
    app.root.render(<CaptureMultiplayerSession onCapture={capture} />);
  });

  await act(async () => {
    await getLatestHookValue(capture).bootstrapFromAuth();
  });

  await act(async () => {
    vi.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS);
  });

  const finalState = getLatestHookValue(capture).sessionState;

  expect(mocks.clearSessionAuth).toHaveBeenCalledTimes(1);
  expect(finalState.status).toBe("auth_lost");
  expect(finalState.pollingStatus).toBe("stopped");
  expect(finalState.errorCode).toBe("TOKEN_INVALID");

  app.unmount();
});

// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App.jsx";
import { DEFAULT_DICE_RESULT_DURATION_MS } from "./components/toast/constants.js";

const mocks = vi.hoisted(() => ({
  latestDicePoolProps: null,
  latestRollSessionOptions: null,
  latestHostProps: null,
  latestJoinProps: null,
  originalClipboard: globalThis.navigator?.clipboard,
  clipboardWriteText: vi.fn(),
  diceResult: vi.fn(),
  sessionAuth: null,
  rollSessionState: null,
  multiplayerSessionState: {
    status: "idle",
  },
  setSessionAuth: vi.fn(),
  bootstrapFromAuth: vi.fn(),
  submitRoll: vi.fn(),
  submitPush: vi.fn(),
  rotateJoinLink: vi.fn(),
  setJoiningEnabled: vi.fn(),
  resetSceneStrain: vi.fn(),
  refreshPlayers: vi.fn(),
  revokePlayer: vi.fn(),
  resetSession: vi.fn(),
  noop: vi.fn(),
}));

const createRollSessionState = (overrides = {}) => ({
  currentRoll: null,
  rollRequest: null,
  recentResults: [],
  isRolling: false,
  canPush: false,
  onRoll: mocks.noop,
  onPush: mocks.noop,
  onClearDice: mocks.noop,
  onRollResolved: mocks.noop,
  ...overrides,
});

vi.mock("./components/JoinSessionView.jsx", () => ({
  default: (props) => {
    mocks.latestJoinProps = props;
    return <div data-testid="join-view">Join Route</div>;
  },
}));

vi.mock("./components/HostSessionView.jsx", () => ({
  default: (props) => {
    mocks.latestHostProps = props;
    return <div data-testid="host-view">Host Route</div>;
  },
}));

vi.mock("./lib/session-auth.js", () => ({
  getSessionAuth: () => mocks.sessionAuth,
  setSessionAuth: (...args) => mocks.setSessionAuth(...args),
}));

vi.mock("./components/DicePoolPanel.jsx", () => ({
  default: (props) => {
    mocks.latestDicePoolProps = props;
    return <div data-testid="dice-pool-panel" />;
  },
}));

vi.mock("./components/ErrorBoundary.jsx", () => ({
  default: ({ children }) => children,
}));

vi.mock("./components/DiceTray3D.jsx", () => ({
  default: () => null,
}));

vi.mock("./hooks/usePoolSelection.js", () => ({
  usePoolSelection: () => ({
    attributeDice: 2,
    skillDice: 1,
    setAttributeDice: mocks.noop,
    setSkillDice: mocks.noop,
  }),
}));

vi.mock("./hooks/useThemePreference.js", () => ({
  useThemePreference: () => ({
    themePreference: "system",
    resolvedTheme: "light",
    setThemePreference: mocks.noop,
  }),
}));

vi.mock("./hooks/useStrainTracker.js", () => ({
  useStrainTracker: () => ({
    normalizedStrainPoints: 0,
    onResetStrain: mocks.noop,
    applyBaneIncrement: mocks.noop,
  }),
}));

vi.mock("./hooks/useCharacterImport.js", () => ({
  useCharacterImport: () => ({
    importFromFile: mocks.noop,
    reset: mocks.noop,
    setSelectedAttribute: mocks.noop,
    setSelectedSkill: mocks.noop,
  }),
}));

vi.mock("./hooks/useRollSession.js", () => ({
  useRollSession: (options) => {
    mocks.latestRollSessionOptions = options;
    return mocks.rollSessionState ?? createRollSessionState();
  },
}));

vi.mock("./hooks/useToast.js", () => ({
  useToast: () => ({
    alert: mocks.noop,
    confirm: () => Promise.resolve(false),
    diceResult: mocks.diceResult,
  }),
}));

vi.mock("./hooks/useMultiplayerSession.js", () => ({
  useMultiplayerSession: () => ({
    sessionState: mocks.multiplayerSessionState,
    bootstrapFromAuth: mocks.bootstrapFromAuth,
    submitRoll: mocks.submitRoll,
    submitPush: mocks.submitPush,
    rotateJoinLink: mocks.rotateJoinLink,
    setJoiningEnabled: mocks.setJoiningEnabled,
    resetSceneStrain: mocks.resetSceneStrain,
    refreshPlayers: mocks.refreshPlayers,
    revokePlayer: mocks.revokePlayer,
    resetSession: mocks.resetSession,
  }),
}));

const createDeferred = () => {
  let resolve;
  let reject;

  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
};

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

afterEach(() => {
  mocks.latestDicePoolProps = null;
  mocks.latestRollSessionOptions = null;
  mocks.latestHostProps = null;
  mocks.latestJoinProps = null;
  mocks.sessionAuth = null;
  mocks.rollSessionState = createRollSessionState();
  mocks.multiplayerSessionState = {
    status: "idle",
  };
  mocks.setSessionAuth.mockReset();
  mocks.bootstrapFromAuth.mockReset();
  mocks.submitRoll.mockReset();
  mocks.submitPush.mockReset();
  mocks.rotateJoinLink.mockReset();
  mocks.setJoiningEnabled.mockReset();
  mocks.resetSceneStrain.mockReset();
  mocks.refreshPlayers.mockReset();
  mocks.revokePlayer.mockReset();
  mocks.resetSession.mockReset();
  mocks.clipboardWriteText.mockReset();
  mocks.diceResult.mockReset();
  if (typeof navigator !== "undefined") {
    if (typeof mocks.originalClipboard === "undefined") {
      delete navigator.clipboard;
    } else {
      Object.defineProperty(navigator, "clipboard", {
        value: mocks.originalClipboard,
        configurable: true,
      });
    }
  }
  window.history.replaceState({}, "", "/");
  document.body.innerHTML = "";
});

test("renders host mode when not on join route and no auth token is present", () => {
  const app = createContainer();

  app.render(<App />);

  expect(app.container.querySelector('[data-testid="host-view"]')).not.toBeNull();
  expect(app.container.querySelector('[data-testid="dice-pool-panel"]')).toBeNull();

  app.unmount();
});

test("host mode invite handoff navigates to join route with hash token", () => {
  const app = createContainer();

  app.render(<App />);

  act(() => {
    mocks.latestHostProps.onUseInviteLink("invite-token-1");
  });

  expect(window.location.pathname).toBe("/join");
  expect(window.location.hash).toBe("#join=invite-token-1");
  expect(app.container.querySelector('[data-testid="join-view"]')).not.toBeNull();
  expect(mocks.latestJoinProps.joinToken).toBe("invite-token-1");

  app.unmount();
});

test("join route parses #join token and passes it to JoinSessionView", () => {
  window.history.replaceState({}, "", "/join#join=token-123");
  const app = createContainer();

  app.render(<App />);

  expect(app.container.querySelector('[data-testid="join-view"]')).not.toBeNull();
  expect(mocks.latestJoinProps.joinToken).toBe("token-123");

  app.unmount();
});

test("join route fallback updates hash token when invite input is resolved", () => {
  window.history.replaceState({}, "", "/join");
  const app = createContainer();

  app.render(<App />);

  act(() => {
    mocks.latestJoinProps.onUseInviteLink("invite-token-2");
  });

  expect(window.location.pathname).toBe("/join");
  expect(window.location.hash).toBe("#join=invite-token-2");
  expect(mocks.latestJoinProps.joinToken).toBe("invite-token-2");

  app.unmount();
});

test("join success stores in-memory auth, clears hash, and exits join route", () => {
  window.history.replaceState({}, "", "/join#join=token-123");
  const app = createContainer();

  app.render(<App />);

  const authState = {
    sessionToken: "player-token-1",
    sessionId: 7,
    role: "player",
    self: {
      token_id: 31,
      display_name: "Alice",
      role: "player",
    },
  };

  act(() => {
    mocks.latestJoinProps.onJoinSuccess(authState);
  });

  expect(mocks.setSessionAuth).toHaveBeenCalledWith(authState);
  expect(mocks.bootstrapFromAuth).toHaveBeenCalledTimes(0);
  expect(window.location.pathname).toBe("/");
  expect(window.location.hash).toBe("");

  app.unmount();
});

test("host success stores in-memory auth and triggers session bootstrap", () => {
  const app = createContainer();
  const authState = {
    sessionToken: "gm-token-1",
    sessionId: 7,
    role: "gm",
    self: null,
  };

  mocks.setSessionAuth.mockImplementation((nextAuth) => {
    mocks.sessionAuth = nextAuth;
  });

  app.render(<App />);

  act(() => {
    mocks.latestHostProps.onHostSuccess(authState);
  });

  expect(mocks.setSessionAuth).toHaveBeenCalledWith(authState);
  expect(mocks.bootstrapFromAuth).toHaveBeenCalledTimes(1);

  app.unmount();
});

test("renders session mode and bootstraps when in-memory auth exists", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };

  app.render(<App />);

  expect(app.container.querySelector('[data-testid="dice-pool-panel"]')).not.toBeNull();
  expect(mocks.bootstrapFromAuth).toHaveBeenCalledTimes(1);

  app.unmount();
});

test("session mode renders multiplayer status in the header", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1 }, { tokenId: 2 }],
  };

  app.render(<App />);

  const heading = app.container.querySelector("h1");
  const connectionDot = app.container.querySelector(
    '[data-testid="session-connection-dot"]',
  );
  const roleIndicator = app.container.querySelector(
    '[data-testid="session-role-indicator"]',
  );

  expect(heading?.textContent).toBe("Streetwise Night");
  expect(connectionDot).not.toBeNull();
  expect(connectionDot?.className).toContain("is-online");
  expect(connectionDot?.getAttribute("aria-label")).toContain("Connected");
  expect(roleIndicator).not.toBeNull();
  expect(roleIndicator?.textContent).toContain("Role");
  expect(roleIndicator?.textContent).toContain("Player");
  expect(app.container.querySelector('[data-testid="session-summary"]')).toBeNull();
  expect(mocks.bootstrapFromAuth).toHaveBeenCalledTimes(0);

  app.unmount();
});

test("session mode uses authoritative strain points for roll state and top pill", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1 }, { tokenId: 2 }],
  };

  app.render(<App />);

  const strainPillValue = app.container.querySelector(".strain-pill strong");

  expect(strainPillValue?.textContent).toBe("4");
  expect(mocks.latestRollSessionOptions?.normalizedStrainPoints).toBe(4);

  app.unmount();
});

test("session mode hides top-bar strain reset for non-GM players", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1 }, { tokenId: 2 }],
  };

  app.render(<App />);

  const topResetButton = app.container.querySelector('[aria-label="Reset strain points"]');

  expect(topResetButton).toBeNull();

  app.unmount();
});

test("session mode allows GM top-bar strain reset and routes to multiplayer API", async () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "gm-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "gm",
    sessionId: 7,
    sessionName: "Streetwise Night",
    joiningEnabled: true,
    sceneStrain: 4,
    players: [
      { tokenId: 1, role: "gm", displayName: "GM" },
      { tokenId: 31, role: "player", displayName: "Alice" },
    ],
  };
  mocks.resetSceneStrain.mockResolvedValue({
    ok: true,
    sceneStrain: 0,
  });

  app.render(<App />);

  const topResetButton = app.container.querySelector('[aria-label="Reset strain points"]');

  await act(async () => {
    topResetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });

  expect(mocks.resetSceneStrain).toHaveBeenCalledTimes(1);

  app.unmount();
});

test("session mode shows reconnecting label while polling is in backoff", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "backoff",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1 }, { tokenId: 2 }],
  };

  app.render(<App />);

  const connectionDot = app.container.querySelector(
    '[data-testid="session-connection-dot"]',
  );

  expect(connectionDot).not.toBeNull();
  expect(connectionDot?.className).toContain("is-pending");
  expect(connectionDot?.getAttribute("aria-label")).toContain("Reconnecting");

  app.unmount();
});

test("session mode shows connection error label when session state is error", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "error",
    pollingStatus: "stopped",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1 }, { tokenId: 2 }],
    errorMessage: "Unable to reach session service.",
  };

  app.render(<App />);

  const connectionDot = app.container.querySelector(
    '[data-testid="session-connection-dot"]',
  );
  const connectionError = app.container.querySelector(
    '[data-testid="session-connection-error"]',
  );
  const retryButton = app.container.querySelector('[data-testid="session-retry-button"]');

  expect(connectionDot).not.toBeNull();
  expect(connectionDot?.className).toContain("is-error");
  expect(connectionDot?.getAttribute("aria-label")).toContain("Connection Error");
  expect(connectionError?.textContent).toContain("Unable to reach session service.");
  expect(retryButton).not.toBeNull();

  app.unmount();
});

test("session mode retry button re-runs bootstrap once while request is pending", async () => {
  const app = createContainer();
  const retryDeferred = createDeferred();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "error",
    pollingStatus: "stopped",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1 }, { tokenId: 2 }],
    errorMessage: "Unable to reach session service.",
  };
  mocks.bootstrapFromAuth.mockReturnValue(retryDeferred.promise);

  app.render(<App />);

  const retryButton = app.container.querySelector('[data-testid="session-retry-button"]');

  await act(async () => {
    retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });

  expect(mocks.bootstrapFromAuth).toHaveBeenCalledTimes(1);
  expect(retryButton?.hasAttribute("disabled")).toBe(true);
  expect(app.container.querySelector('[data-testid="session-retry-status"]')).not.toBeNull();

  await act(async () => {
    retryDeferred.resolve(null);
    await retryDeferred.promise;
  });

  expect(retryButton?.hasAttribute("disabled")).toBe(false);
  expect(app.container.querySelector('[data-testid="session-retry-status"]')).toBeNull();

  app.unmount();
});

test("session mode renders ordered multiplayer event feed entries", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1 }, { tokenId: 2 }],
    events: [
      {
        id: 11,
        type: "join",
        payload: {
          token_id: 31,
          display_name: "Alice",
        },
        actor: {
          token_id: 31,
          display_name: "Alice",
          role: "player",
        },
      },
      {
        id: 12,
        type: "roll",
        payload: {
          successes: 2,
          banes: 1,
        },
        actor: {
          token_id: 31,
          display_name: "Alice",
          role: "player",
        },
      },
      {
        id: 13,
        type: "strain_reset",
        payload: {},
        actor: {
          token_id: 1,
          display_name: "GM",
          role: "gm",
        },
      },
    ],
  };

  app.render(<App />);

  const feed = app.container.querySelector('[data-testid="session-events-feed"]');
  const items = Array.from(
    app.container.querySelectorAll('[data-testid="session-event-item"]'),
  );

  expect(feed).not.toBeNull();
  expect(items).toHaveLength(3);
  expect(items[0].textContent).toContain("#11");
  expect(items[0].textContent).toContain("joined the session");
  expect(items[1].textContent).toContain("#12");
  expect(items[1].textContent).toContain("rolled 2 successes, 1 banes");
  expect(items[2].textContent).toContain("#13");
  expect(items[2].textContent).toContain("Strain points were reset");

  app.unmount();
});

test("session mode emits remote roll and push toasts with actor names", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    self: {
      tokenId: 31,
      role: "player",
      displayName: "Alice",
    },
    players: [{ tokenId: 1 }, { tokenId: 2 }],
    events: [
      {
        id: 21,
        type: "roll",
        payload: {
          successes: 2,
          banes: 1,
        },
        actor: {
          token_id: 44,
          display_name: "Fred",
          role: "player",
        },
      },
      {
        id: 22,
        type: "push",
        payload: {
          successes: 3,
          banes: 2,
          has_strain: true,
        },
        actor: {
          token_id: 45,
          display_name: "Jane",
          role: "player",
        },
      },
    ],
  };

  app.render(<App />);

  expect(mocks.diceResult).toHaveBeenCalledTimes(2);
  expect(mocks.diceResult).toHaveBeenNthCalledWith(1, {
    title: "Roll Result - Fred",
    message: "2 successes, 1 banes",
    duration: DEFAULT_DICE_RESULT_DURATION_MS,
  });
  expect(mocks.diceResult).toHaveBeenNthCalledWith(2, {
    title: "Push Result - Jane",
    message: "3 successes, 2 banes (with Strain)",
    duration: DEFAULT_DICE_RESULT_DURATION_MS,
  });

  app.render(<App />);
  expect(mocks.diceResult).toHaveBeenCalledTimes(2);

  app.unmount();
});

test("session mode skips remote roll toasts for self-authored events", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    self: {
      tokenId: 31,
      role: "player",
      displayName: "Alice",
    },
    players: [{ tokenId: 1 }, { tokenId: 2 }],
    events: [
      {
        id: 31,
        type: "roll",
        payload: {
          successes: 1,
          banes: 0,
        },
        actor: {
          token_id: 31,
          display_name: "Alice",
          role: "player",
        },
      },
      {
        id: 32,
        type: "push",
        payload: {
          successes: 2,
          banes: 1,
          strain: true,
        },
        actor: {
          token_id: 31,
          display_name: "Alice",
          role: "player",
        },
      },
    ],
  };

  app.render(<App />);

  expect(mocks.diceResult).not.toHaveBeenCalled();

  app.unmount();
});

test("session mode only renders GM controls for gm role", () => {
  const app = createContainer();
  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1, role: "gm", displayName: "GM" }],
  };

  app.render(<App />);

  expect(app.container.querySelector('[data-testid="gm-controls-panel"]')).toBeNull();

  app.unmount();
});

test("session mode wires gm control actions and revoke player action", async () => {
  const app = createContainer();
  const rotateDeferred = createDeferred();
  mocks.sessionAuth = {
    sessionToken: "gm-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "gm",
    sessionId: 7,
    sessionName: "Streetwise Night",
    joiningEnabled: true,
    sceneStrain: 4,
    players: [
      { tokenId: 1, role: "gm", displayName: "GM" },
      { tokenId: 31, role: "player", displayName: "Alice" },
    ],
  };
  mocks.rotateJoinLink.mockReturnValue(rotateDeferred.promise);
  mocks.setJoiningEnabled.mockResolvedValue({
    ok: true,
    joiningEnabled: false,
  });
  mocks.resetSceneStrain.mockResolvedValue({
    ok: true,
    sceneStrain: 0,
  });
  mocks.refreshPlayers.mockResolvedValue({
    ok: true,
    players: [{ tokenId: 1, role: "gm", displayName: "GM" }],
  });
  mocks.revokePlayer.mockResolvedValue({
    ok: true,
    revokedTokenId: 31,
  });
  mocks.clipboardWriteText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: mocks.clipboardWriteText,
    },
    configurable: true,
  });

  app.render(<App />);

  expect(app.container.querySelector('[data-testid="gm-controls-panel"]')).not.toBeNull();
  expect(app.container.textContent).toContain("Disable Joining");

  await act(async () => {
    app.container
      .querySelector('[data-testid="gm-rotate-link-button"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  expect(mocks.rotateJoinLink).toHaveBeenCalledTimes(1);
  expect(app.container.querySelector('[data-testid="gm-action-pending"]')).not.toBeNull();
  expect(
    app.container
      .querySelector('[data-testid="gm-joining-toggle-button"]')
      ?.hasAttribute("disabled"),
  ).toBe(true);

  await act(async () => {
    rotateDeferred.resolve({
      ok: true,
      joinLink: "https://api.example.com/join#join=abc123",
    });
    await rotateDeferred.promise;
  });

  expect(app.container.textContent).toContain("Join link rotated.");
  expect(app.container.querySelector('[data-testid="gm-copy-link-button"]')).not.toBeNull();

  await act(async () => {
    app.container
      .querySelector('[data-testid="gm-copy-link-button"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  expect(mocks.clipboardWriteText).toHaveBeenCalledWith(
    "https://api.example.com/join#join=abc123",
  );
  expect(app.container.textContent).toContain("Join link copied.");

  await act(async () => {
    app.container
      .querySelector('[data-testid="gm-joining-toggle-button"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  expect(mocks.setJoiningEnabled).toHaveBeenCalledWith(false);

  await act(async () => {
    app.container
      .querySelector('[data-testid="gm-reset-strain-button"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  expect(mocks.resetSceneStrain).toHaveBeenCalledTimes(1);

  await act(async () => {
    app.container
      .querySelector('[data-testid="gm-refresh-players-button"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  expect(mocks.refreshPlayers).toHaveBeenCalledTimes(1);

  await act(async () => {
    app.container
      .querySelector('[data-testid="gm-revoke-player-31"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  expect(mocks.revokePlayer).toHaveBeenCalledWith(31);

  app.unmount();
});

test("session mode submits roll outcomes once and disables controls while pending", async () => {
  const app = createContainer();
  const submitDeferred = createDeferred();

  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1 }, { tokenId: 2 }],
  };
  mocks.rollSessionState = createRollSessionState({
    currentRoll: {
      action: "roll",
      rolledAt: 1710000000000,
      outcomes: {
        successes: 2,
        banes: 1,
        hasStrain: false,
      },
      pushableDiceIds: ["die-1"],
      dice: [],
    },
    recentResults: [{ id: "roll-1710000000000", summary: "2 successes, 1 banes" }],
    canPush: true,
  });
  mocks.submitRoll.mockReturnValue(submitDeferred.promise);

  app.render(<App />);

  await act(async () => {
    await Promise.resolve();
  });

  expect(mocks.submitRoll).toHaveBeenCalledTimes(1);
  expect(mocks.submitRoll).toHaveBeenCalledWith({
    successes: 2,
    banes: 1,
  });
  expect(mocks.latestDicePoolProps.isActionSubmitPending).toBe(true);
  expect(mocks.latestDicePoolProps.isPrimaryActionDisabled).toBe(true);
  expect(mocks.latestDicePoolProps.isPushDisabled).toBe(true);

  app.render(<App />);
  expect(mocks.submitRoll).toHaveBeenCalledTimes(1);

  await act(async () => {
    submitDeferred.resolve({ ok: true });
    await submitDeferred.promise;
  });

  expect(mocks.latestDicePoolProps.isActionSubmitPending).toBe(false);
  expect(mocks.latestDicePoolProps.isPrimaryActionDisabled).toBe(false);
  expect(mocks.latestDicePoolProps.isPushDisabled).toBe(false);

  app.unmount();
});

test("session mode submits push outcomes and shows non-fatal action errors", async () => {
  const app = createContainer();

  mocks.sessionAuth = {
    sessionToken: "player-token-1",
  };
  mocks.multiplayerSessionState = {
    status: "ready",
    pollingStatus: "running",
    role: "player",
    sessionName: "Streetwise Night",
    sceneStrain: 4,
    players: [{ tokenId: 1 }, { tokenId: 2 }],
  };
  mocks.rollSessionState = createRollSessionState({
    currentRoll: {
      action: "push",
      rolledAt: 1710000001000,
      outcomes: {
        successes: 3,
        banes: 2,
        hasStrain: true,
      },
      pushableDiceIds: [],
      dice: [],
    },
    recentResults: [
      { id: "push-1710000001000", summary: "3 successes, 2 banes (with Strain)" },
    ],
    canPush: false,
  });
  mocks.submitPush.mockResolvedValue({
    ok: false,
    errorCode: "VALIDATION_ERROR",
    errorMessage: "Unable to submit push event.",
  });

  app.render(<App />);

  await act(async () => {
    await Promise.resolve();
  });

  expect(mocks.submitPush).toHaveBeenCalledTimes(1);
  expect(mocks.submitPush).toHaveBeenCalledWith({
    successes: 3,
    banes: 2,
    strain: true,
  });
  expect(app.container.textContent).toContain("Unable to submit push event.");

  app.unmount();
});

test("renders auth-lost mode and supports reset action", () => {
  const app = createContainer();
  mocks.multiplayerSessionState = {
    status: "auth_lost",
  };

  app.render(<App />);

  expect(app.container.textContent).toContain("Session Ended");
  const resetButton = Array.from(app.container.querySelectorAll("button")).find(
    (button) => button.textContent?.includes("Return to host/join"),
  );

  act(() => {
    resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(mocks.resetSession).toHaveBeenCalledTimes(1);

  app.unmount();
});

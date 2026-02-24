// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App.jsx";

const mocks = vi.hoisted(() => ({
  latestDicePoolProps: null,
  latestHostProps: null,
  latestJoinProps: null,
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
  useRollSession: () => mocks.rollSessionState ?? createRollSessionState(),
}));

vi.mock("./hooks/useToast.js", () => ({
  useToast: () => ({
    alert: mocks.noop,
    confirm: () => Promise.resolve(false),
    diceResult: mocks.noop,
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

test("session mode renders multiplayer session summary details", () => {
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

  const summary = app.container.querySelector('[data-testid="session-summary"]');

  expect(summary).not.toBeNull();
  expect(summary?.textContent).toContain("Connected");
  expect(summary?.textContent).toContain("Player");
  expect(summary?.textContent).toContain("Streetwise Night");
  expect(summary?.textContent).toContain("4");
  expect(summary?.textContent).toContain("2");
  expect(mocks.bootstrapFromAuth).toHaveBeenCalledTimes(0);

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
  expect(items[2].textContent).toContain("Scene strain was reset");

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
  mocks.rotateJoinLink.mockResolvedValue({
    ok: true,
    joinLink: "https://api.example.com/join#join=abc123",
  });
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
  expect(app.container.textContent).toContain("Join link rotated.");

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

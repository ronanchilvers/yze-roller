// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App.jsx";

const mocks = vi.hoisted(() => ({
  latestHostProps: null,
  latestJoinProps: null,
  sessionAuth: null,
  multiplayerSessionState: {
    status: "idle",
  },
  setSessionAuth: vi.fn(),
  bootstrapFromAuth: vi.fn(),
  resetSession: vi.fn(),
  noop: vi.fn(),
}));

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
  default: () => <div data-testid="dice-pool-panel" />,
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
  useRollSession: () => ({
    currentRoll: null,
    rollRequest: null,
    recentResults: [],
    isRolling: false,
    canPush: false,
    onRoll: mocks.noop,
    onPush: mocks.noop,
    onClearDice: mocks.noop,
    onRollResolved: mocks.noop,
  }),
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
    resetSession: mocks.resetSession,
  }),
}));

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
  mocks.latestHostProps = null;
  mocks.latestJoinProps = null;
  mocks.sessionAuth = null;
  mocks.multiplayerSessionState = {
    status: "idle",
  };
  mocks.setSessionAuth.mockReset();
  mocks.bootstrapFromAuth.mockReset();
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

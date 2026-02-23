// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App.jsx";

const mocks = vi.hoisted(() => ({
  latestJoinProps: null,
  setSessionAuth: vi.fn(),
  bootstrapFromAuth: vi.fn(),
  noop: vi.fn(),
}));

vi.mock("./components/JoinSessionView.jsx", () => ({
  default: (props) => {
    mocks.latestJoinProps = props;
    return <div data-testid="join-view">Join Route</div>;
  },
}));

vi.mock("./lib/session-auth.js", () => ({
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
    sessionState: {
      status: "idle",
    },
    bootstrapFromAuth: mocks.bootstrapFromAuth,
    resetSession: mocks.noop,
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
  mocks.latestJoinProps = null;
  mocks.setSessionAuth.mockReset();
  mocks.bootstrapFromAuth.mockReset();
  window.history.replaceState({}, "", "/");
  document.body.innerHTML = "";
});

test("join route parses #join token and passes it to JoinSessionView", () => {
  window.history.replaceState({}, "", "/join#join=token-123");
  const app = createContainer();

  app.render(<App />);

  expect(app.container.querySelector('[data-testid="join-view"]')).not.toBeNull();
  expect(mocks.latestJoinProps.joinToken).toBe("token-123");

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
  expect(mocks.bootstrapFromAuth).toHaveBeenCalledTimes(1);
  expect(window.location.pathname).toBe("/");
  expect(window.location.hash).toBe("");

  app.unmount();
});

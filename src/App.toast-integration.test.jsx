// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App.jsx";
import { DEFAULT_DICE_RESULT_DURATION_MS } from "./components/toast/constants.js";

const mocks = vi.hoisted(() => ({
  rollSessionState: null,
  diceResult: vi.fn(),
  noop: vi.fn(),
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
    onAttributeChange: mocks.noop,
    onSkillChange: mocks.noop,
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
  useRollSession: () => mocks.rollSessionState,
}));

vi.mock("./hooks/useToast.js", () => ({
  useToast: () => ({
    alert: mocks.noop,
    confirm: () => Promise.resolve(false),
    diceResult: mocks.diceResult,
  }),
}));

const createRollSessionState = (overrides = {}) => ({
  currentRoll: null,
  rollRequest: null,
  recentResults: [],
  isHistoryOpen: false,
  setIsHistoryOpen: mocks.noop,
  isRolling: false,
  canPush: false,
  onRoll: mocks.noop,
  onPush: mocks.noop,
  onClearDice: mocks.noop,
  onRollResolved: mocks.noop,
  ...overrides,
});

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
  mocks.diceResult.mockReset();
  document.body.innerHTML = "";
});

test("emits one local roll toast for a newly resolved roll and skips duplicates", () => {
  const app = createContainer();

  mocks.rollSessionState = createRollSessionState();
  app.render(<App />);
  expect(mocks.diceResult).not.toHaveBeenCalled();

  mocks.rollSessionState = createRollSessionState({
    currentRoll: {
      action: "roll",
      rolledAt: 1710000000000,
      outcomes: {
        successes: 2,
        banes: 1,
        hasStrain: false,
      },
      pushableDiceIds: [],
      dice: [],
    },
    recentResults: [{ id: "1-1710000000000", summary: "2 successes, 1 banes" }],
  });
  app.render(<App />);

  expect(mocks.diceResult).toHaveBeenCalledTimes(1);
  expect(mocks.diceResult).toHaveBeenCalledWith({
    breakdown: "2 successes, 1 banes",
    total: "2",
    duration: DEFAULT_DICE_RESULT_DURATION_MS,
  });

  app.render(<App />);
  expect(mocks.diceResult).toHaveBeenCalledTimes(1);

  app.unmount();
});


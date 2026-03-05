// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import App, { REMOTE_ROLL_EVENT_BRIDGE_KEY } from "./App.jsx";
import { DEFAULT_DICE_RESULT_DURATION_MS } from "./components/toast/constants.js";

const mocks = vi.hoisted(() => ({
  rollSessionState: null,
  diceResult: vi.fn(),
  noop: vi.fn(),
}));

vi.mock("./components/DicePoolPanel.jsx", () => ({
  default: ({ onClearDice, onPrimaryAction, onRollWithCounts }) => (
    <div data-testid="dice-pool-panel">
      <button
        type="button"
        data-testid="roll-with-key-button"
        onClick={() =>
          onRollWithCounts?.({
            attributeDice: 4,
            skillDice: 2,
            isKeyAttributeRoll: true,
            rollTypeLabel: "Empathy",
          })
        }
      >
        Roll With Key
      </button>
      <button
        type="button"
        data-testid="roll-no-key-button"
        onClick={() =>
          onRollWithCounts?.({
            attributeDice: 4,
            skillDice: 2,
            rollTypeLabel: "Sneak (Agility)",
          })
        }
      >
        Roll Without Key
      </button>
      <button
        type="button"
        data-testid="primary-roll-button"
        onClick={() => onPrimaryAction?.()}
      >
        Primary Roll
      </button>
      <button
        type="button"
        data-testid="clear-dice-button"
        onClick={() => onClearDice?.()}
      >
        Clear Dice
      </button>
    </div>
  ),
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
    onIncrementStrain: mocks.noop,
    onDecrementStrain: mocks.noop,
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
  delete window[REMOTE_ROLL_EVENT_BRIDGE_KEY];
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
      rollTypeLabel: "Sneak (Agility)",
      pushableDiceIds: [],
      dice: [],
    },
    recentResults: [{ id: "1-1710000000000", summary: "2 successes, 1 bane" }],
  });
  app.render(<App />);

  expect(mocks.diceResult).toHaveBeenCalledTimes(1);
  expect(mocks.diceResult).toHaveBeenCalledWith({
    title: "Roll Result",
    message: "Sneak (Agility) - 2 successes, 1 bane",
    duration: DEFAULT_DICE_RESULT_DURATION_MS,
  });

  app.render(<App />);
  expect(mocks.diceResult).toHaveBeenCalledTimes(1);

  app.unmount();
});

test("dedupes repeated local event ids emitted from rerender", () => {
  const app = createContainer();

  mocks.rollSessionState = createRollSessionState({
    currentRoll: {
      action: "roll",
      rolledAt: 1710000002000,
      outcomes: {
        successes: 4,
        banes: 0,
        hasStrain: false,
      },
      pushableDiceIds: [],
      dice: [],
    },
    recentResults: [{ id: "repeat-local-id", summary: "4 successes, 0 banes" }],
  });

  app.render(<App />);
  expect(mocks.diceResult).toHaveBeenCalledTimes(1);

  app.render(<App />);
  expect(mocks.diceResult).toHaveBeenCalledTimes(1);

  app.unmount();
});

test("clear state does not emit a synthetic local roll toast", () => {
  const app = createContainer();
  const nowSpy = vi.spyOn(Date, "now");
  nowSpy.mockReturnValue(1710000004000);

  mocks.rollSessionState = createRollSessionState({
    currentRoll: {
      action: "roll",
      rolledAt: 1710000004000,
      outcomes: {
        successes: 2,
        banes: 1,
        hasStrain: false,
      },
      pushableDiceIds: [],
      dice: [],
    },
    recentResults: [{ id: "clear-case-1710000004000", summary: "2 successes, 1 bane" }],
  });

  app.render(<App />);
  expect(mocks.diceResult).toHaveBeenCalledTimes(1);

  nowSpy.mockReturnValue(1710000008000);
  mocks.rollSessionState = createRollSessionState({
    currentRoll: null,
    recentResults: [{ id: "clear-case-1710000004000", summary: "2 successes, 1 bane" }],
  });

  app.render(<App />);
  expect(mocks.diceResult).toHaveBeenCalledTimes(1);

  nowSpy.mockRestore();
  app.unmount();
});

test("emits push result toast with strain summary", () => {
  const app = createContainer();

  mocks.rollSessionState = createRollSessionState({
    currentRoll: {
      action: "push",
      rolledAt: 1710000003000,
      outcomes: {
        successes: 1,
        banes: 2,
        hasStrain: true,
      },
      rollTypeLabel: "Empathy",
      pushableDiceIds: [],
      dice: [],
    },
    recentResults: [{ id: "push-1710000003000", summary: "1 success, 2 banes (with Strain)" }],
  });

  app.render(<App />);

  expect(mocks.diceResult).toHaveBeenCalledTimes(1);
  expect(mocks.diceResult).toHaveBeenCalledWith({
    title: "Push Result",
    message: "Empathy - 1 success, 2 banes (with Strain)",
    duration: DEFAULT_DICE_RESULT_DURATION_MS,
  });

  app.unmount();
});

test("does not emit local result toast when no stable local identity is present", () => {
  const app = createContainer();

  mocks.rollSessionState = createRollSessionState({
    currentRoll: {
      action: "roll",
      rolledAt: undefined,
      outcomes: {
        successes: 2,
        banes: 0,
        hasStrain: false,
      },
      pushableDiceIds: [],
      dice: [],
    },
    recentResults: [],
  });

  app.render(<App />);
  expect(mocks.diceResult).not.toHaveBeenCalled();

  app.unmount();
});

test("does not render the legacy tray results panel", () => {
  const app = createContainer();

  mocks.rollSessionState = createRollSessionState();
  app.render(<App />);

  const trayResults = app.container.querySelector(".tray-results");
  const trayPanel = app.container.querySelector(".tray-panel");
  expect(trayResults).toBeNull();
  expect(trayPanel).toBeNull();

  app.unmount();
});

test("clear dice resets roll modifier to zero", () => {
  const app = createContainer();
  const onClearDice = vi.fn();

  mocks.rollSessionState = createRollSessionState({
    onClearDice,
  });
  app.render(<App />);

  const modifierValue = app.container.querySelector(
    '[aria-label="Current modifier dice"] strong',
  );
  const incrementModifierButton = app.container.querySelector(
    '[aria-label="Increase modifier"]',
  );
  const clearDiceButton = app.container.querySelector(
    '[data-testid="clear-dice-button"]',
  );

  expect(modifierValue?.textContent).toBe("0");

  act(() => {
    incrementModifierButton.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
  });
  expect(modifierValue?.textContent).toBe("+1");

  act(() => {
    clearDiceButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(modifierValue?.textContent).toBe("0");
  expect(onClearDice).toHaveBeenCalledTimes(1);

  app.unmount();
});

test("import roll with key attribute requests bonus key attribute die", () => {
  const app = createContainer();
  const onRoll = vi.fn();

  mocks.rollSessionState = createRollSessionState({
    onRoll,
  });
  app.render(<App />);

  const rollWithKeyButton = app.container.querySelector(
    '[data-testid="roll-with-key-button"]',
  );
  act(() => {
    rollWithKeyButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onRoll).toHaveBeenCalledWith({
    includeKeyAttributeDie: true,
    rollTypeLabel: "Empathy",
  });

  app.unmount();
});

test("import roll without key attribute requests a standard roll", () => {
  const app = createContainer();
  const onRoll = vi.fn();

  mocks.rollSessionState = createRollSessionState({
    onRoll,
  });
  app.render(<App />);

  const rollNoKeyButton = app.container.querySelector(
    '[data-testid="roll-no-key-button"]',
  );
  act(() => {
    rollNoKeyButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onRoll).toHaveBeenCalledWith({
    includeKeyAttributeDie: false,
    rollTypeLabel: "Sneak (Agility)",
  });

  app.unmount();
});

test("exposes remote roll ingestion seam and emits remote actor toast payload", () => {
  const app = createContainer();

  mocks.rollSessionState = createRollSessionState();
  app.render(<App />);

  const ingestRemoteEvent = window[REMOTE_ROLL_EVENT_BRIDGE_KEY];
  expect(typeof ingestRemoteEvent).toBe("function");

  act(() => {
    ingestRemoteEvent({
      source: "local",
      actorId: "Watcher",
      action: "push",
      rollTypeLabel: "Scout (Wits)",
      successes: 3,
      banes: 2,
      hasStrain: true,
      occurredAt: 1710000001111,
    });
  });

  expect(mocks.diceResult).toHaveBeenCalledTimes(1);
  expect(mocks.diceResult).toHaveBeenCalledWith({
    title: "Watcher pushed",
    message: "Scout (Wits) - 3 successes, 2 banes (with Strain)",
    duration: DEFAULT_DICE_RESULT_DURATION_MS,
  });

  act(() => {
    ingestRemoteEvent({
      eventId: "remote-event-1",
      actorId: "Watcher",
      action: "push",
      successes: 3,
      banes: 2,
      hasStrain: true,
      occurredAt: 1710000001111,
    });
  });

  expect(mocks.diceResult).toHaveBeenCalledTimes(2);

  act(() => {
    ingestRemoteEvent({
      eventId: "remote-event-1",
      actorId: "Watcher",
      action: "push",
      successes: 3,
      banes: 2,
      hasStrain: true,
      occurredAt: 1710000001111,
    });
  });

  expect(mocks.diceResult).toHaveBeenCalledTimes(2);

  app.unmount();
});

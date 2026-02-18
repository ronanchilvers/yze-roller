// @vitest-environment jsdom
import { useState } from "react";
import PropTypes from "prop-types";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, test, expect, vi } from "vitest";
import DicePoolPanel from "./DicePoolPanel.jsx";

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

const getSkillButton = (container, skillName) => {
  const items = Array.from(
    container.querySelectorAll(".import-summary-content li"),
  );
  const match = items.find((item) => item.textContent?.includes(skillName));
  return match ? match.querySelector("button") : null;
};

const baseCharacter = {
  name: 'Bessie "Mope" Collins',
  attributes: {
    strength: 1,
    agility: 2,
    wits: 3,
    empathy: 4,
  },
  skills: {
    Sneak: 3,
    Streetwise: 2,
    Hoodwink: 2,
  },
  skillAttributes: {
    Sneak: "Agility",
    Streetwise: "Wits",
    Hoodwink: "Empathy",
  },
};

const TestHarness = ({
  importStateOverrides = {},
  onRollWithCounts,
  onPrimaryAction = vi.fn(),
  primaryActionLabel = "Roll Dice",
  onImportFile = vi.fn(),
  onResetImport = vi.fn(),
  onRoll = vi.fn(),
  onPush = vi.fn(),
  pushActionLabel = "Push 0 Dice",
  isPushDisabled = true,
  onClearDice = vi.fn(),
  isClearDisabled = false,
}) => {
  TestHarness.propTypes = {
    importStateOverrides: PropTypes.object,
    onRollWithCounts: PropTypes.func,
    onPrimaryAction: PropTypes.func,
    primaryActionLabel: PropTypes.string,
    onImportFile: PropTypes.func,
    onResetImport: PropTypes.func,
    onRoll: PropTypes.func,
    onPush: PropTypes.func,
    pushActionLabel: PropTypes.string,
    isPushDisabled: PropTypes.bool,
    onClearDice: PropTypes.func,
    isClearDisabled: PropTypes.bool,
  };
  const [importState, setImportState] = useState({
    fileName: "Bessie-Collins.json",
    status: "ready",
    character: baseCharacter,
    errors: [],
    warnings: [],
    selectedAttribute: "strength",
    selectedSkill: null,
    ...importStateOverrides,
  });

  return (
    <DicePoolPanel
      attributeDice={2}
      skillDice={1}
      onAttributeChange={vi.fn()}
      onSkillChange={vi.fn()}
      onPrimaryAction={onPrimaryAction}
      primaryActionLabel={primaryActionLabel}
      isPrimaryActionDisabled={false}
      isRolling={false}
      setAttributeDice={vi.fn()}
      setSkillDice={vi.fn()}
      onRoll={onRoll}
      onRollWithCounts={onRollWithCounts}
      importState={importState}
      onImportFile={onImportFile}
      onResetImport={onResetImport}
      onPush={onPush}
      pushActionLabel={pushActionLabel}
      isPushDisabled={isPushDisabled}
      onClearDice={onClearDice}
      isClearDisabled={isClearDisabled}
      onSelectAttribute={(value) =>
        setImportState((current) => ({
          ...current,
          selectedAttribute: value,
        }))
      }
      onSelectSkill={(value) =>
        setImportState((current) => ({
          ...current,
          selectedSkill: value,
        }))
      }
    />
  );
};

afterEach(() => {
  document.body.innerHTML = "";
});

test("renders manual tab by default", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness />);
  });

  expect(container.querySelector("#attributeDice")).not.toBeNull();
  expect(container.querySelector("#skillDice")).not.toBeNull();
  expect(container.querySelector("#characterImport")).toBeNull();

  unmount();
});

test("renders panel action row with push and clear controls", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <TestHarness pushActionLabel="Push 4 Dice" isPushDisabled={false} />,
    );
  });

  const panelActionRow = container.querySelector(".panel-action-row");
  expect(panelActionRow).not.toBeNull();
  expect(getButtonByText(container, "Push 4 Dice")).toBeDefined();
  expect(getButtonByText(container, "Clear Dice")).toBeDefined();

  unmount();
});

test("switching to import tab shows JSON upload when no character is loaded", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <TestHarness
        importStateOverrides={{
          status: "idle",
          character: null,
          fileName: "",
        }}
      />,
    );
  });

  const importTab = getButtonByText(container, "Import Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.querySelector("#characterImport")).not.toBeNull();
  expect(container.querySelector(".import-summary")).toBeNull();
  expect(container.querySelector(".import-summary-item")).toBeNull();
  expect(getButtonByText(container, "Clear Character")).toBeUndefined();

  unmount();
});

test("switching to import tab shows fields and actions for a loaded character", () => {
  const onRollWithCounts = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness onRollWithCounts={onRollWithCounts} />);
  });

  const importTab = getButtonByText(container, "Import Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.querySelector("#characterImport")).not.toBeNull();
  expect(container.querySelector(".import-summary")).not.toBeNull();
  expect(container.querySelectorAll(".import-summary-item").length).toBeGreaterThan(0);
  expect(getButtonByText(container, "Clear Character")).toBeDefined();

  unmount();
});

test("selecting a skill auto-selects the mapped attribute and locks attribute selection", () => {
  const onRollWithCounts = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness onRollWithCounts={onRollWithCounts} />);
  });

  const importTab = getButtonByText(container, "Import Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const skillButton = getSkillButton(container, "Sneak");

  act(() => {
    skillButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onRollWithCounts).toHaveBeenCalledWith({
    attributeDice: 2,
    skillDice: 3,
  });

  unmount();
});

test("roll from import tab uses attribute and skill dice counts", () => {
  const onRollWithCounts = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness onRollWithCounts={onRollWithCounts} />);
  });

  const importTab = getButtonByText(container, "Import Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const skillButton = getSkillButton(container, "Streetwise");
  act(() => {
    skillButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onRollWithCounts).toHaveBeenCalledWith({
    attributeDice: 3,
    skillDice: 2,
  });

  unmount();
});

test("import roll defers to primary action when in push mode", () => {
  const onPrimaryAction = vi.fn();
  const onRoll = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <TestHarness
        onPrimaryAction={onPrimaryAction}
        onRoll={onRoll}
        primaryActionLabel="Push 2 Dice"
      />,
    );
  });

  const importTab = getButtonByText(container, "Import Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const skillButton = getSkillButton(container, "Sneak");
  act(() => {
    skillButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onRoll).toHaveBeenCalled();
  expect(onPrimaryAction).not.toHaveBeenCalled();

  unmount();
});

test("panel action row buttons call push and clear handlers", () => {
  const onPush = vi.fn();
  const onClearDice = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <TestHarness
        onPush={onPush}
        onClearDice={onClearDice}
        pushActionLabel="Push 2 Dice"
        isPushDisabled={false}
      />,
    );
  });

  const pushButton = getButtonByText(container, "Push 2 Dice");
  const clearButton = getButtonByText(container, "Clear Dice");
  act(() => {
    pushButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  act(() => {
    clearButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onPush).toHaveBeenCalledTimes(1);
  expect(onClearDice).toHaveBeenCalledTimes(1);

  unmount();
});

// @vitest-environment jsdom
import { useState } from "react";
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
}) => {
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
      onRoll={vi.fn()}
      onRollWithCounts={onRollWithCounts}
      importState={importState}
      onImportFile={onImportFile}
      onResetImport={onResetImport}
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
  expect(container.querySelector("#importAttribute")).toBeNull();
  expect(container.querySelector("#importSkill")).toBeNull();
  expect(getButtonByText(container, "Roll Dice")).toBeUndefined();
  expect(getButtonByText(container, "Clear Import")).toBeUndefined();

  unmount();
});

test("switching to import tab shows fields and actions for a loaded character", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness />);
  });

  const importTab = getButtonByText(container, "Import Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.querySelector("#characterImport")).toBeNull();
  expect(container.querySelector("#importAttribute")).not.toBeNull();
  expect(container.querySelector("#importSkill")).not.toBeNull();
  expect(getButtonByText(container, "Roll Dice")).toBeDefined();
  expect(getButtonByText(container, "Clear Import")).toBeDefined();

  unmount();
});

test("selecting a skill auto-selects the mapped attribute and locks attribute selection", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness />);
  });

  const importTab = getButtonByText(container, "Import Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const skillSelect = container.querySelector("#importSkill");
  const attributeSelect = container.querySelector("#importAttribute");

  act(() => {
    skillSelect.value = "Sneak";
    skillSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(attributeSelect.value).toBe("agility");
  expect(attributeSelect.disabled).toBe(true);

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

  const skillSelect = container.querySelector("#importSkill");
  act(() => {
    skillSelect.value = "Streetwise";
    skillSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const rollButton = getButtonByText(container, "Roll Dice");
  act(() => {
    rollButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onRollWithCounts).toHaveBeenCalledWith({
    attributeDice: 3,
    skillDice: 2,
  });

  unmount();
});

test("import roll defers to primary action when in push mode", () => {
  const onPrimaryAction = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <TestHarness
        onPrimaryAction={onPrimaryAction}
        primaryActionLabel="Push 2 Dice"
      />,
    );
  });

  const importTab = getButtonByText(container, "Import Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const rollButton = getButtonByText(container, "Push 2 Dice");
  act(() => {
    rollButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onPrimaryAction).toHaveBeenCalled();

  unmount();
});
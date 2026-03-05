// @vitest-environment jsdom
import { useState } from "react";
import PropTypes from "prop-types";
import { createRoot } from "react-dom/client";
import { act, Simulate } from "react-dom/test-utils";
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

const getAttributeButton = (container, attributeName) => {
  const items = Array.from(
    container.querySelectorAll(".import-summary-content li"),
  );
  const match = items.find((item) => item.textContent?.includes(attributeName));
  return match ? match.querySelector("button") : null;
};

const baseCharacter = {
  name: 'Bessie "Mope" Collins',
  archetype: "Card Twister",
  keyAttributeKey: "empathy",
  keyAttributeLabel: "Empathy",
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
  attributeDice = 2,
  skillDice = 1,
  importStateOverrides = {},
  onRollWithCounts,
  onPrimaryAction = vi.fn(),
  setAttributeDice = vi.fn(),
  setSkillDice = vi.fn(),
  primaryActionLabel = "Roll Dice",
  onImportFile = vi.fn(),
  onResetImport = vi.fn(),
  onRoll = vi.fn(),
  onPush = vi.fn(),
  pushActionLabel = "Push 0 Dice",
  isPushDisabled = true,
  onClearDice = vi.fn(),
  isClearDisabled = false,
  recentResults = [],
}) => {
  TestHarness.propTypes = {
    importStateOverrides: PropTypes.object,
    onRollWithCounts: PropTypes.func,
    onPrimaryAction: PropTypes.func,
    setAttributeDice: PropTypes.func,
    setSkillDice: PropTypes.func,
    primaryActionLabel: PropTypes.string,
    attributeDice: PropTypes.number,
    skillDice: PropTypes.number,
    onImportFile: PropTypes.func,
    onResetImport: PropTypes.func,
    onRoll: PropTypes.func,
    onPush: PropTypes.func,
    pushActionLabel: PropTypes.string,
    isPushDisabled: PropTypes.bool,
    onClearDice: PropTypes.func,
    isClearDisabled: PropTypes.bool,
    recentResults: PropTypes.arrayOf(PropTypes.object),
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
      attributeDice={attributeDice}
      skillDice={skillDice}
      onPrimaryAction={onPrimaryAction}
      primaryActionLabel={primaryActionLabel}
      isPrimaryActionDisabled={false}
      isRolling={false}
      setAttributeDice={setAttributeDice}
      setSkillDice={setSkillDice}
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
      recentResults={recentResults}
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
  expect(container.querySelector("#rollModifier")).toBeNull();
  expect(container.querySelector("#characterImport")).toBeNull();
  expect(getButtonByText(container, "Roll History")).toBeDefined();

  unmount();
});

test("renders pool tabs in manual, import, history order", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness />);
  });

  const tabLabels = Array.from(container.querySelectorAll(".pool-tabs .pool-tab")).map(
    (tab) => tab.textContent?.trim(),
  );
  expect(tabLabels).toEqual(["Manual", "Character", "Roll History"]);

  unmount();
});

test("does not render the legacy dice modifier slider", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness />);
  });

  expect(container.querySelector("#rollModifier")).toBeNull();
  expect(container.querySelector(".modifier-control")).toBeNull();
  expect(container.querySelector(".modifier-slider")).toBeNull();

  unmount();
});

test("manual inputs can be cleared while editing", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness />);
  });

  const attributeInput = container.querySelector("#attributeDice");
  const skillInput = container.querySelector("#skillDice");

  act(() => {
    Simulate.change(attributeInput, { target: { value: "" } });
    Simulate.change(skillInput, { target: { value: "" } });
  });

  expect(attributeInput.value).toBe("");
  expect(skillInput.value).toBe("");

  unmount();
});

test("manual roll validates and commits counts before rolling", () => {
  const setAttributeDice = vi.fn();
  const setSkillDice = vi.fn();
  const onRollWithCounts = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(
      <TestHarness
        setAttributeDice={setAttributeDice}
        setSkillDice={setSkillDice}
        onRollWithCounts={onRollWithCounts}
      />,
    );
  });

  const attributeInput = container.querySelector("#attributeDice");
  const skillInput = container.querySelector("#skillDice");
  const rollButton = getButtonByText(container, "Roll Dice");

  act(() => {
    Simulate.change(attributeInput, { target: { value: "" } });
    Simulate.change(skillInput, { target: { value: "999" } });
  });

  act(() => {
    rollButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(setAttributeDice).toHaveBeenCalledWith(1);
  expect(setSkillDice).toHaveBeenCalledWith(20);
  expect(onRollWithCounts).toHaveBeenCalledWith({
    attributeDice: 1,
    skillDice: 20,
  });
  expect(attributeInput.value).toBe("1");
  expect(skillInput.value).toBe("20");

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

  const importTab = getButtonByText(container, "Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.querySelector("#characterImport")).not.toBeNull();
  expect(container.querySelector(".import-summary")).toBeNull();
  expect(container.querySelector(".import-summary-item")).toBeNull();
  expect(getButtonByText(container, "Clear Character")).toBeUndefined();

  unmount();
});

test("switching to history tab shows empty state when there are no entries", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness recentResults={[]} />);
  });

  const historyTab = getButtonByText(container, "Roll History");
  act(() => {
    historyTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.querySelector(".history-panel")).not.toBeNull();
  expect(container.querySelector(".history-list")).toBeNull();
  expect(container.querySelector(".history-empty")?.textContent?.trim()).toBe(
    "No roll history yet.",
  );

  unmount();
});

test("switching to history tab renders roll history entries", () => {
  const { container, root, unmount } = createContainer();
  const recentResults = [
    {
      id: "roll-1",
      summary: "Roll result - 2 successes, 1 banes",
    },
    {
      id: "push-1",
      summary: "Push result - 2 successes, 2 banes (with Strain)",
    },
  ];

  act(() => {
    root.render(<TestHarness recentResults={recentResults} />);
  });

  const historyTab = getButtonByText(container, "Roll History");
  act(() => {
    historyTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const historyItems = Array.from(container.querySelectorAll(".history-item")).map(
    (item) => item.textContent?.trim(),
  );
  expect(historyItems).toEqual([
    "Roll result - 2 successes, 1 banes",
    "Push result - 2 successes, 2 banes (with Strain)",
  ]);

  unmount();
});

test("switching to import tab shows fields and actions for a loaded character", () => {
  const onRollWithCounts = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness onRollWithCounts={onRollWithCounts} />);
  });

  const importTab = getButtonByText(container, "Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(container.querySelector("#characterImport")).not.toBeNull();
  expect(container.querySelector(".import-summary")).not.toBeNull();
  expect(container.querySelector(".import-character-name")?.textContent).toBe(
    'Bessie "Mope" Collins - Card Twister',
  );
  expect(container.querySelectorAll(".import-summary-item").length).toBeGreaterThan(0);
  expect(getButtonByText(container, "Clear Character")).toBeDefined();

  unmount();
});

test("highlights the imported key attribute in the attribute summary", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness />);
  });

  const importTab = getButtonByText(container, "Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const keyLabel = container.querySelector(
    ".import-summary-attribute-label.is-key-attribute",
  );
  expect(keyLabel?.textContent?.trim()).toBe("Empathy");
  const keyCountButton = getAttributeButton(container, "Empathy");
  expect(keyCountButton?.textContent?.trim()).toBe("5");
  expect(keyCountButton?.classList.contains("is-key-attribute-count")).toBe(
    true,
  );

  unmount();
});

test("selecting a skill auto-selects the mapped attribute and locks attribute selection", () => {
  const onRollWithCounts = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness onRollWithCounts={onRollWithCounts} />);
  });

  const importTab = getButtonByText(container, "Character");
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
    isKeyAttributeRoll: false,
  });

  unmount();
});

test("roll from import tab uses attribute and skill dice counts", () => {
  const onRollWithCounts = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness onRollWithCounts={onRollWithCounts} />);
  });

  const importTab = getButtonByText(container, "Character");
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
    isKeyAttributeRoll: false,
  });

  unmount();
});

test("skill rows show mapped attributes without brackets and with distinct attribute labels", () => {
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness />);
  });

  const importTab = getButtonByText(container, "Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const skillLabels = Array.from(
    container.querySelectorAll(".import-summary-skill-label"),
  ).map((node) => node.textContent?.trim());
  const attributeLabels = Array.from(
    container.querySelectorAll(".import-summary-skill-attribute"),
  ).map((node) => node.textContent?.trim());
  const groupedLabels = Array.from(
    container.querySelectorAll(".import-summary-skill-label-group"),
  ).map((node) => node.textContent ?? "");

  expect(skillLabels).toContain("Sneak");
  expect(skillLabels).toContain("Streetwise");
  expect(skillLabels).toContain("Hoodwink");
  expect(attributeLabels).toContain("Agility");
  expect(attributeLabels).toContain("Wits");
  expect(attributeLabels).toContain("Empathy");
  expect(groupedLabels).toContain("SneakAgility");
  expect(groupedLabels).toContain("StreetwiseWits");
  expect(groupedLabels).toContain("HoodwinkEmpathy");
  expect(groupedLabels.some((value) => value.includes("("))).toBe(false);
  expect(groupedLabels.some((value) => value.includes(")"))).toBe(false);
  expect(groupedLabels.some((value) => value.includes("-"))).toBe(false);

  unmount();
});

test("rolling a key attribute includes key attribute roll flag", () => {
  const onRollWithCounts = vi.fn();
  const { container, root, unmount } = createContainer();

  act(() => {
    root.render(<TestHarness onRollWithCounts={onRollWithCounts} />);
  });

  const importTab = getButtonByText(container, "Character");
  act(() => {
    importTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const empathyButton = getAttributeButton(container, "Empathy");
  act(() => {
    empathyButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  expect(onRollWithCounts).toHaveBeenCalledWith({
    attributeDice: 4,
    skillDice: 0,
    isKeyAttributeRoll: true,
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

  const importTab = getButtonByText(container, "Character");
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

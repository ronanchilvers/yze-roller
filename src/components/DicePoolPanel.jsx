import { useMemo, useState } from "react";
import { REQUIRED_ATTRIBUTES } from "../lib/character-import.js";
import { CANONICAL_SKILLS } from "../data/skill-mappings.js";

const TAB_MANUAL = "manual";
const TAB_IMPORT = "import";

const buildAttributeLabel = (attributeKey) =>
  REQUIRED_ATTRIBUTES[attributeKey] ?? attributeKey;

const buildAttributeKeyFromLabel = (label) => {
  const normalized = String(label ?? "")
    .trim()
    .toLowerCase();

  return (
    Object.keys(REQUIRED_ATTRIBUTES).find(
      (key) => REQUIRED_ATTRIBUTES[key].toLowerCase() === normalized,
    ) ?? null
  );
};

const DicePoolPanel = ({
  attributeDice,
  skillDice,
  onAttributeChange,
  onSkillChange,
  onPrimaryAction,
  primaryActionLabel,
  isPrimaryActionDisabled,
  isRolling,
  setAttributeDice,
  setSkillDice,
  onRoll,
  onRollWithCounts,
  importState,
  onImportFile,
  onResetImport,
  onSelectAttribute,
  onSelectSkill,
}) => {
  const [activeTab, setActiveTab] = useState(TAB_MANUAL);

  const {
    fileName = "",
    status = "idle",
    character = null,
    errors = [],
    warnings = [],
    selectedAttribute = null,
    selectedSkill = null,
  } = importState ?? {};

  const attributeOptions = useMemo(() => {
    if (!character?.attributes) {
      return [];
    }

    return Object.keys(REQUIRED_ATTRIBUTES).filter(
      (key) => character.attributes[key] != null,
    );
  }, [character]);

  const skillOptions = useMemo(() => {
    if (!character?.skills) {
      return [];
    }

    return CANONICAL_SKILLS.filter((skill) => skill in character.skills);
  }, [character]);

  const skillColumnSplit = Math.ceil(skillOptions.length / 2);
  const skillColumnOne = skillOptions.slice(0, skillColumnSplit);
  const skillColumnTwo = skillOptions.slice(skillColumnSplit);

  const selectedSkillAttributeLabel = selectedSkill
    ? character?.skillAttributes?.[selectedSkill] ?? null
    : null;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      onResetImport?.();
      return;
    }

    onImportFile?.(file);
  };

  const handleAttributeSelect = (event) => {
    if (selectedSkill) {
      return;
    }
    const value = event.target.value || null;
    onSelectAttribute?.(value);
    if (value) {
      onSelectSkill?.(null);
    }
  };

  const handleSkillSelect = (event) => {
    const value = event.target.value || null;
    onSelectSkill?.(value);

    if (!value) {
      return;
    }

    const derivedKey = buildAttributeKeyFromLabel(
      character?.skillAttributes?.[value],
    );
    onSelectAttribute?.(derivedKey);
  };

  const isPushMode = primaryActionLabel !== "Roll Dice";

  const handleImportRoll = () => {
    if (isPushMode) {
      onPrimaryAction?.();
      return;
    }

    if (!character || !selectedAttribute) {
      return;
    }

    const attributeValue = character.attributes[selectedAttribute] ?? 0;
    const skillValue = selectedSkill ? character.skills?.[selectedSkill] ?? 0 : 0;

    if (typeof onRollWithCounts === "function") {
      onRollWithCounts({
        attributeDice: attributeValue,
        skillDice: skillValue,
      });
      return;
    }

    if (typeof setAttributeDice === "function") {
      setAttributeDice(attributeValue);
    }

    if (typeof setSkillDice === "function") {
      setSkillDice(skillValue);
    }

    if (typeof onRoll === "function") {
      onRoll();
      return;
    }

    if (typeof onPrimaryAction === "function") {
      onPrimaryAction();
    }
  };

  const isImportReady = status === "ready" && Boolean(character);
  const importDisabled =
    status === "loading" ||
    isRolling ||
    !isImportReady ||
    (!isPushMode && !selectedAttribute) ||
    (isPushMode && isPrimaryActionDisabled);
  const importButtonLabel =
    status === "loading"
      ? "Importing..."
      : isRolling
        ? isPushMode
          ? "Pushing..."
          : "Rolling..."
        : isPushMode
          ? primaryActionLabel
          : "Roll Dice";

  return (
    <section className="panel controls-panel" aria-labelledby="dice-pool-label">
      <div className="panel-header">
        <h2 id="dice-pool-label">Dice Pool</h2>
      </div>
      <p className="panel-copy">
        Choose Attribute and Skill dice. Strain dice are added automatically from
        Strain Points.
      </p>

      <div className="pool-tabs" role="tablist" aria-label="Dice pool modes">
        <button
          type="button"
          role="tab"
          className={`pool-tab ${activeTab === TAB_MANUAL ? "is-active" : ""}`}
          aria-selected={activeTab === TAB_MANUAL}
          onClick={() => handleTabChange(TAB_MANUAL)}
        >
          Manual
        </button>
        <button
          type="button"
          role="tab"
          className={`pool-tab ${activeTab === TAB_IMPORT ? "is-active" : ""}`}
          aria-selected={activeTab === TAB_IMPORT}
          onClick={() => handleTabChange(TAB_IMPORT)}
        >
          Import Character
        </button>
      </div>

      {activeTab === TAB_MANUAL ? (
        <div className="control-grid" role="tabpanel">
          <label className="number-field" htmlFor="attributeDice">
            <span>Attribute Dice</span>
            <input
              id="attributeDice"
              name="attributeDice"
              type="number"
              min={1}
              max={20}
              inputMode="numeric"
              value={attributeDice}
              onChange={onAttributeChange}
            />
          </label>

          <label className="number-field" htmlFor="skillDice">
            <span>Skill Dice</span>
            <input
              id="skillDice"
              name="skillDice"
              type="number"
              min={0}
              max={20}
              inputMode="numeric"
              value={skillDice}
              onChange={onSkillChange}
            />
          </label>

          <button
            type="button"
            className="pool-action-button"
            onClick={onPrimaryAction}
            disabled={isPrimaryActionDisabled}
          >
            {isRolling ? (isPushMode ? "Pushing..." : "Rolling...") : primaryActionLabel}
          </button>
        </div>
      ) : (
        <div className="import-panel" role="tabpanel">
          <div className="import-controls">
            {!isImportReady ? (
              <label className="file-field" htmlFor="characterImport">
                <span>Character JSON</span>
                <input
                  id="characterImport"
                  name="characterImport"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <>
                <label className="select-field" htmlFor="importAttribute">
                  <span>Attribute</span>
                  <select
                    id="importAttribute"
                    name="importAttribute"
                    value={selectedAttribute ?? ""}
                    onChange={handleAttributeSelect}
                    disabled={Boolean(selectedSkill)}
                  >
                    <option value="" disabled>
                      Choose an attribute
                    </option>
                    {attributeOptions.map((attributeKey) => (
                      <option key={attributeKey} value={attributeKey}>
                        {buildAttributeLabel(attributeKey)} - {character?.attributes?.[attributeKey] ?? 0}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="select-field" htmlFor="importSkill">
                  <span>Skill</span>
                  <select
                    id="importSkill"
                    name="importSkill"
                    value={selectedSkill ?? ""}
                    onChange={handleSkillSelect}
                    disabled={!isImportReady}
                  >
                    <option value="">Choose a skill (optional)</option>
                    {skillOptions.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill} - {character?.skills?.[skill] ?? 0}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="pool-action-button"
                  onClick={handleImportRoll}
                  disabled={importDisabled}
                >
                  {importButtonLabel}
                </button>


              </>
            )}
          </div>



          <div className="import-status-row">
            <div className="import-status" role="status" aria-live="polite">
              {fileName ? null : <p>No character loaded yet.</p>}
              {status === "loading" ? <p>Loading character…</p> : null}
              {character ? (
                <p>
                  Character: <strong>{character.name}</strong>
                </p>
              ) : null}
            </div>
            {isImportReady ? (
              <button
                type="button"
                className="pool-action-button import-clear-button"
                onClick={onResetImport}
                disabled={status === "loading"}
              >
                Clear Character
              </button>
            ) : null}
          </div>

          {character ? (
            <div className="import-summary">
              <div className="import-summary-grid">
                <div className="import-summary-section">
                  <p className="import-summary-title">Attributes</p>
                  {attributeOptions.length > 0 ? (
                    <ul className="import-summary-content">
                      {attributeOptions.map((attributeKey) => (
                        <li key={attributeKey} className="import-summary-item">
                          {buildAttributeLabel(attributeKey)}:{" "}
                          {character?.attributes?.[attributeKey] ?? 0}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="import-summary-empty">
                      No attributes available.
                    </p>
                  )}
                </div>
                <div className="import-summary-section">
                  <p className="import-summary-title">Skills</p>
                  {skillOptions.length > 0 ? (
                    <ul className="import-summary-content">
                      {skillColumnOne.map((skill) => (
                        <li key={skill} className="import-summary-item">
                          {skill}: {character?.skills?.[skill] ?? 0}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="import-summary-empty">No skills available.</p>
                  )}
                </div>
                <div className="import-summary-section">
                  <p className="import-summary-title" aria-hidden="true">
                    &nbsp;
                  </p>
                  {skillOptions.length > 0 ? (
                    <ul className="import-summary-content">
                      {skillColumnTwo.map((skill) => (
                        <li key={skill} className="import-summary-item">
                          {skill}: {character?.skills?.[skill] ?? 0}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {errors.length > 0 ? (
            <div className="import-errors" role="alert">
              <p>Import errors:</p>
              <ul>
                {errors.map((message, index) => (
                  <li key={`${message}-${index}`}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}



          {selectedSkillAttributeLabel ? (
            <p className="import-attribute-hint">
              Uses attribute: <strong>{selectedSkillAttributeLabel}</strong>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default DicePoolPanel;
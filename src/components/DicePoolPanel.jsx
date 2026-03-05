import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { REQUIRED_ATTRIBUTES } from "../lib/character-import.js";
import { CANONICAL_SKILLS } from "../data/skill-mappings.js";
import {
  ATTRIBUTE_DICE_OPTS,
  SKILL_DICE_OPTS,
  normalizeDiceCount,
} from "../lib/dice.js";

const TAB_MANUAL = "manual";
const TAB_IMPORT = "import";
const TAB_HISTORY = "history";

const buildAttributeLabel = (attributeKey) =>
  REQUIRED_ATTRIBUTES[attributeKey] ?? attributeKey;

const toNonNegativeInt = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
};

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
  onPush,
  pushActionLabel,
  isPushDisabled,
  onClearDice,
  isClearDisabled,
  recentResults,
}) => {
  const [activeTab, setActiveTab] = useState(TAB_MANUAL);
  const [manualAttributeInput, setManualAttributeInput] = useState(
    String(attributeDice),
  );
  const [manualSkillInput, setManualSkillInput] = useState(String(skillDice));

  const {
    fileName = "",
    status = "idle",
    character = null,
    errors = [],
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
  const safeRecentResults = useMemo(() => {
    if (!Array.isArray(recentResults)) {
      return [];
    }

    return recentResults
      .map((entry, index) => {
        const summary =
          typeof entry?.summary === "string" ? entry.summary.trim() : "";
        if (!summary) {
          return null;
        }

        const id =
          typeof entry?.id === "string" && entry.id
            ? entry.id
            : `recent-result-${index}`;

        return { id, summary };
      })
      .filter(Boolean);
  }, [recentResults]);

  useEffect(() => {
    setManualAttributeInput(String(attributeDice));
  }, [attributeDice]);

  useEffect(() => {
    setManualSkillInput(String(skillDice));
  }, [skillDice]);

  const commitManualCounts = () => {
    const normalizedAttribute = normalizeDiceCount(
      manualAttributeInput,
      ATTRIBUTE_DICE_OPTS,
    );
    const normalizedSkill = normalizeDiceCount(manualSkillInput, SKILL_DICE_OPTS);

    setAttributeDice(normalizedAttribute);
    setSkillDice(normalizedSkill);
    setManualAttributeInput(String(normalizedAttribute));
    setManualSkillInput(String(normalizedSkill));

    return {
      attributeDice: normalizedAttribute,
      skillDice: normalizedSkill,
    };
  };

  const handleManualPrimaryAction = () => {
    const counts = commitManualCounts();

    if (typeof onRollWithCounts === "function") {
      onRollWithCounts(counts);
      return;
    }

    onPrimaryAction();
  };


  const getSkillAttributeKey = (skill) =>
    buildAttributeKeyFromLabel(character?.skillAttributes?.[skill]);

  const handleSummaryRoll = ({ attributeKey, skillKey = null }) => {
    if (!character || !attributeKey) {
      return;
    }
    const isKeyAttributeRoll = character?.keyAttributeKey === attributeKey;

    onSelectAttribute?.(attributeKey);
    onSelectSkill?.(skillKey);

    const attributeValue = character.attributes?.[attributeKey] ?? 0;
    const skillValue = skillKey ? character.skills?.[skillKey] ?? 0 : 0;

    if (typeof onRollWithCounts === "function") {
      onRollWithCounts({
        attributeDice: attributeValue,
        skillDice: skillValue,
        isKeyAttributeRoll,
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
      onRoll({ includeKeyAttributeDie: isKeyAttributeRoll });
      return;
    }

    if (primaryActionLabel === "Roll Dice" && typeof onPrimaryAction === "function") {
      onPrimaryAction();
    }
  };

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



  const isImportReady = status === "ready" && Boolean(character);
  const renderSkillSummaryItem = (skill) => {
    const attributeKey = getSkillAttributeKey(skill);
    const rawSkillValue = character?.skills?.[skill];
    const skillValue = toNonNegativeInt(rawSkillValue);
    const rawAttributeValue = attributeKey
      ? character?.attributes?.[attributeKey]
      : 0;
    const attributeValue = toNonNegativeInt(rawAttributeValue);
    const isKeyAttribute = attributeKey === character?.keyAttributeKey;
    const displayAttributeValue = isKeyAttribute
      ? attributeValue + 1
      : attributeValue;
    const combinedDiceValue = skillValue + displayAttributeValue;
    const attributeLabel = character?.skillAttributes?.[skill] ?? "Unknown";
    const isDisabled = isRolling || status === "loading" || !attributeKey;

    return (
      <li key={skill}>
        <span className="import-summary-skill-label-group">
          <span className="import-summary-skill-label">
            {skill}
            <span>{skillValue}</span>
          </span>
          <span className="import-summary-skill-attribute">
            {attributeLabel}
            <span>{displayAttributeValue}</span>
          </span>
        </span>{" "}
        <button
          type="button"
          className="import-summary-item"
          onClick={() =>
            handleSummaryRoll({
              attributeKey,
              skillKey: skill,
            })
          }
          disabled={isDisabled}
          aria-label={`Roll ${skill} (${attributeLabel}) dice`}
        >
          {combinedDiceValue}
        </button>
      </li>
    );
  };

  return (
    <section className="panel controls-panel" aria-labelledby="dice-pool-label">
      <div className="panel-header">
        <h2 id="dice-pool-label">Dice Pool</h2>
      </div>
      <p className="panel-copy">
        Choose Attribute and Skill dice. Strain dice are added automatically from
        Strain Dice.
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
          Character
        </button>
        <button
          type="button"
          role="tab"
          className={`pool-tab ${activeTab === TAB_HISTORY ? "is-active" : ""}`}
          aria-selected={activeTab === TAB_HISTORY}
          onClick={() => handleTabChange(TAB_HISTORY)}
        >
          Roll History
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
              value={manualAttributeInput}
              onChange={(event) => setManualAttributeInput(event.target.value)}
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
              value={manualSkillInput}
              onChange={(event) => setManualSkillInput(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="pool-action-button"
            onClick={handleManualPrimaryAction}
            disabled={isPrimaryActionDisabled}
          >
            {isRolling ? "Rolling..." : primaryActionLabel}
          </button>
        </div>
      ) : null}

      {activeTab === TAB_IMPORT ? (
        <div className="import-panel" role="tabpanel">
          <div className="import-controls">
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
          </div>



          <div className="import-status-row">
            <div className="import-status" role="status" aria-live="polite">
              {fileName ? null : <p>No character loaded yet.</p>}
              {status === "loading" ? <p>Loading character…</p> : null}
              {character ? (
                <h3 className="import-character-name">
                  {`${character.name} - ${character.archetype}`}
                </h3>
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
                      {attributeOptions.map((attributeKey) => {
                        const attributeValue =
                          character?.attributes?.[attributeKey] ?? 0;
                        const isKeyAttribute =
                          attributeKey === character?.keyAttributeKey;
                        const displayAttributeValue = isKeyAttribute
                          ? attributeValue + 1
                          : attributeValue;
                        return (
                          <li key={attributeKey}>
                            <span
                              className={`import-summary-attribute-label ${isKeyAttribute ? "is-key-attribute" : ""}`}
                            >
                              {buildAttributeLabel(attributeKey)}
                            </span>{" "}
                            <button
                              type="button"
                              className={`import-summary-item ${isKeyAttribute ? "is-key-attribute-count" : ""}`}
                              onClick={() =>
                                handleSummaryRoll({
                                  attributeKey,
                                  skillKey: null,
                                })
                              }
                              disabled={isRolling || status === "loading"}
                              aria-label={`Roll ${buildAttributeLabel(attributeKey)} dice`}
                            >
                              {displayAttributeValue}
                            </button>
                          </li>
                        );
                      })}
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
                      {skillColumnOne.map((skill) => renderSkillSummaryItem(skill))}
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
                      {skillColumnTwo.map((skill) => renderSkillSummaryItem(skill))}
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
        </div>
      ) : null}

      {activeTab === TAB_HISTORY ? (
        <div className="history-panel" role="tabpanel">
          {safeRecentResults.length > 0 ? (
            <ul className="history-list">
              {safeRecentResults.map((result) => (
                <li key={result.id} className="history-item">
                  {result.summary}
                </li>
              ))}
            </ul>
          ) : (
            <p className="history-empty">No roll history yet.</p>
          )}
        </div>
      ) : null}
      <div className="panel-action-row">
        <button
          type="button"
          className="pool-action-button secondary-action-button"
          onClick={onPush}
          disabled={isPushDisabled}
        >
          {pushActionLabel}
        </button>
        <button
          type="button"
          className="pool-action-button secondary-action-button"
          onClick={onClearDice}
          disabled={isClearDisabled}
        >
          Clear Dice
        </button>
      </div>
    </section>
  );
};

DicePoolPanel.propTypes = {
  attributeDice: PropTypes.number.isRequired,
  skillDice: PropTypes.number.isRequired,
  onPrimaryAction: PropTypes.func.isRequired,
  primaryActionLabel: PropTypes.string.isRequired,
  isPrimaryActionDisabled: PropTypes.bool.isRequired,
  isRolling: PropTypes.bool.isRequired,
  setAttributeDice: PropTypes.func.isRequired,
  setSkillDice: PropTypes.func.isRequired,
  onRoll: PropTypes.func.isRequired,
  onRollWithCounts: PropTypes.func,
  importState: PropTypes.shape({
    fileName: PropTypes.string,
    status: PropTypes.string,
    character: PropTypes.object,
    errors: PropTypes.arrayOf(PropTypes.string),
  }),
  onImportFile: PropTypes.func.isRequired,
  onResetImport: PropTypes.func.isRequired,
  onSelectAttribute: PropTypes.func.isRequired,
  onSelectSkill: PropTypes.func.isRequired,
  onPush: PropTypes.func.isRequired,
  pushActionLabel: PropTypes.string.isRequired,
  isPushDisabled: PropTypes.bool.isRequired,
  onClearDice: PropTypes.func.isRequired,
  isClearDisabled: PropTypes.bool.isRequired,
  recentResults: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      summary: PropTypes.string,
    }),
  ),
};

export default DicePoolPanel;

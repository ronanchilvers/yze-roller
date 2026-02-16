import { Suspense, lazy, useEffect, useRef, useState } from "react";
import "./App.css";
import { usePoolSelection } from "./hooks/usePoolSelection.js";
import { useStrainTracker } from "./hooks/useStrainTracker.js";
import { useRollSession } from "./hooks/useRollSession.js";
import { useCharacterImport } from "./hooks/useCharacterImport.js";
import { useThemePreference } from "./hooks/useThemePreference.js";
import DicePoolPanel from "./components/DicePoolPanel.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const MAX_PREVIOUS_RESULTS = 10;
const DiceTray3D = lazy(() => import("./components/DiceTray3D.jsx"));

function App() {
  const {
    attributeDice,
    skillDice,
    setAttributeDice,
    setSkillDice,
    onAttributeChange,
    onSkillChange,
  } = usePoolSelection();
  const { themePreference, resolvedTheme, setThemePreference } =
    useThemePreference();

  const { normalizedStrainPoints, onResetStrain, applyBaneIncrement } =
    useStrainTracker();

  const characterImport = useCharacterImport();
  const {
    importFromFile,
    reset: resetImport,
    setSelectedAttribute,
    setSelectedSkill,
  } = characterImport;

  const [overrideCounts, setOverrideCounts] = useState(null);
  const [pendingRollCounts, setPendingRollCounts] = useState(null);

  const effectiveAttributeDice = overrideCounts?.attributeDice ?? attributeDice;
  const effectiveSkillDice = overrideCounts?.skillDice ?? skillDice;

  const {
    currentRoll,
    rollRequest,
    recentResults,
    isHistoryOpen,
    setIsHistoryOpen,
    isRolling,
    canPush,
    onRoll,
    onPush,
    onClearDice,
    onRollResolved,
  } = useRollSession({
    attributeDice: effectiveAttributeDice,
    skillDice: effectiveSkillDice,
    normalizedStrainPoints,
    onBaneIncrement: applyBaneIncrement,
  });
  const activeDice = rollRequest?.dice ?? currentRoll?.dice ?? [];
  const previousResults = recentResults.slice(1, MAX_PREVIOUS_RESULTS + 1);
  const hasPreviousResults = previousResults.length > 0;
  const pushableDiceCount = Number(currentRoll?.pushableDiceIds?.length ?? 0);
  const canClearDice =
    isRolling || activeDice.length > 0 || recentResults.length > 0;
  const hasRolled = Boolean(currentRoll);
  const primaryActionLabel = "Roll Dice";
  const isPrimaryActionDisabled = isRolling;

  const formatRollSummary = (roll) => {
    if (!roll) {
      return "No results yet";
    }
    const withStrain = roll.outcomes.hasStrain ? " (with Strain)" : "";
    return `${roll.outcomes.successes} successes, ${roll.outcomes.banes} banes${withStrain}`;
  };

  const trayLead = isRolling
    ? rollRequest?.action === "push"
      ? "Pushing selected dice..."
      : "Rolling dice..."
    : currentRoll
      ? formatRollSummary(currentRoll)
      : "Roll the dice to see results.";

  const historyPanelRef = useRef(null);

  const onPrimaryAction = () => {
    onRoll();
  };

  const handleRollWithCounts = (counts) => {
    if (!counts) {
      return;
    }

    setOverrideCounts(counts);
    setPendingRollCounts(counts);
  };

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (!pendingRollCounts || isRolling) {
      return;
    }

    onRoll();
    setPendingRollCounts(null);
    setOverrideCounts(null);
  }, [pendingRollCounts, isRolling, onRoll]);

  useEffect(() => {
    if (!isHistoryOpen) {
      return;
    }

    historyPanelRef.current?.focus();
  }, [isHistoryOpen]);

  const handleHistoryKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsHistoryOpen(false);
    }
  };

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="dice-stage-fullscreen" aria-hidden="true">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="tray-loading">
                <span className="tray-spinner" aria-hidden="true" />
                Loading 3D tray…
              </div>
            }
          >
            <DiceTray3D
              dice={activeDice}
              rollRequest={rollRequest}
              onRollResolved={onRollResolved}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
      <section
        id="main-content"
        className="dice-layout"
        aria-label="Year Zero dice roller"
      >
        <header className="top-bar">
          <div>
            <p className="eyebrow">Year Zero Engine</p>
            <h1>Dice Roller</h1>
          </div>
          <div className="top-bar-actions">
            <label className="theme-select" htmlFor="themePreference">
              <span>Theme</span>
              <select
                id="themePreference"
                name="themePreference"
                value={themePreference}
                onChange={(event) => setThemePreference(event.target.value)}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <output className="strain-pill" aria-label="Current strain points">
              <div className="strain-pill-head">
                <span>Strain Points</span>
                <button
                  type="button"
                  className="strain-reset-button"
                  aria-label="Reset strain points"
                  onClick={onResetStrain}
                  disabled={normalizedStrainPoints === 0}
                >
                  ↺
                </button>
              </div>
              <strong>{normalizedStrainPoints}</strong>
            </output>
          </div>
        </header>

        <div className="content-grid">
          <DicePoolPanel
            attributeDice={attributeDice}
            skillDice={skillDice}
            onAttributeChange={onAttributeChange}
            onSkillChange={onSkillChange}
            onPrimaryAction={onPrimaryAction}
            primaryActionLabel={primaryActionLabel}
            isPrimaryActionDisabled={isPrimaryActionDisabled}
            isRolling={isRolling}
            setAttributeDice={setAttributeDice}
            setSkillDice={setSkillDice}
            onRoll={onRoll}
            onRollWithCounts={handleRollWithCounts}
            importState={characterImport}
            onImportFile={importFromFile}
            onResetImport={resetImport}
            onSelectAttribute={setSelectedAttribute}
            onSelectSkill={setSelectedSkill}
          />

          <section className="tray-panel" aria-label="Dice tray" aria-busy={isRolling}>
            <div className="tray-results" role="status" aria-live="polite">
              <div className="tray-results-row">
                <div className="tray-summary-wrap">
                  <p className="tray-lead">{trayLead}</p>
                  {!isRolling && currentRoll && hasPreviousResults ? (
                    <button
                      type="button"
                      className="history-toggle"
                      onClick={() => setIsHistoryOpen((open) => !open)}
                      aria-label={
                        isHistoryOpen
                          ? "Hide previous results"
                          : "Show previous results"
                      }
                      aria-expanded={isHistoryOpen}
                      aria-controls="previous-results-list"
                    >
                      {isHistoryOpen ? "▴" : "▾"}
                    </button>
                  ) : null}
                </div>
                <div className="tray-action-buttons">
                  <button
                    type="button"
                    className="pool-action-button tray-clear-button"
                    onClick={onPush}
                    disabled={isRolling || !hasRolled || !canPush}
                  >
                    Push {pushableDiceCount} Dice
                  </button>
                  <button
                    type="button"
                    className="pool-action-button tray-clear-button"
                    onClick={onClearDice}
                    disabled={!canClearDice}
                  >
                    Clear Dice
                  </button>
                </div>
              </div>
              {hasPreviousResults && isHistoryOpen ? (
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                <div
                  className="history-dropdown"
                  id="previous-results-list"
                  role="dialog"
                  aria-modal="false"
                  tabIndex={-1}
                  onKeyDown={handleHistoryKeyDown}
                  ref={historyPanelRef}
                >

                  <ul className="history-list">
                    {previousResults.map((entry) => (
                      <li key={entry.id}>{entry.summary}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

          </section>
        </div>
      </section>
    </main>
  );
}

export default App;

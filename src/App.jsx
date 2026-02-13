import { Suspense, lazy } from "react";
import "./App.css";
import { MAX_DICE } from "./lib/dice";
import { usePoolSelection } from "./hooks/usePoolSelection";
import { useStrainTracker } from "./hooks/useStrainTracker";
import { useRollSession } from "./hooks/useRollSession";

const MIN_ATTRIBUTE_DICE = 1;
const MIN_SKILL_DICE = 0;
const MAX_PREVIOUS_RESULTS = 10;
const DiceTray3D = lazy(() => import("./components/DiceTray3D"));

function App() {
  const { attributeDice, skillDice, onAttributeChange, onSkillChange } =
    usePoolSelection();

  const { normalizedStrainPoints, onResetStrain, applyBaneIncrement } =
    useStrainTracker();

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
    attributeDice,
    skillDice,
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
  const primaryActionLabel = hasRolled
    ? `Push ${pushableDiceCount} Dice`
    : "Roll Dice";
  const isPrimaryActionDisabled = isRolling || (hasRolled && !canPush);

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

  const onPrimaryAction = () => {
    if (hasRolled) {
      onPush();
      return;
    }

    onRoll();
  };

  return (
    <main className="app-shell">
      <section className="dice-layout" aria-label="Year Zero dice roller">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Year Zero Engine</p>
            <h1>Dice Roller</h1>
          </div>
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
        </header>

        <div className="content-grid">
          <section
            className="panel controls-panel"
            aria-labelledby="dice-pool-label"
          >
            <div className="panel-header">
              <h2 id="dice-pool-label">Dice Pool</h2>
            </div>
            <p className="panel-copy">
              Choose Attribute and Skill dice. Strain dice are added
              automatically from Strain Points.
            </p>

            <div className="control-grid">
              <label className="number-field" htmlFor="attributeDice">
                <span>Attribute Dice</span>
                <input
                  id="attributeDice"
                  name="attributeDice"
                  type="number"
                  min={MIN_ATTRIBUTE_DICE}
                  max={MAX_DICE}
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
                  min={MIN_SKILL_DICE}
                  max={MAX_DICE}
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
                {isRolling
                  ? rollRequest?.action === "push"
                    ? "Pushing..."
                    : "Rolling..."
                  : primaryActionLabel}
              </button>
            </div>
          </section>

          <section className="panel tray-panel" aria-label="Dice tray">
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
                <button
                  type="button"
                  className="panel-reset-button tray-clear-button"
                  onClick={onClearDice}
                  disabled={!canClearDice}
                >
                  Clear Dice
                </button>
              </div>
              {hasPreviousResults && isHistoryOpen ? (
                <div className="history-dropdown" id="previous-results-list">
                  <ul className="history-list">
                    {previousResults.map((entry) => (
                      <li key={entry.id}>{entry.summary}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="tray-stage" aria-label="3D dice tray">
              <Suspense
                fallback={<div className="tray-loading">Loading 3D tray…</div>}
              >
                <DiceTray3D
                  dice={activeDice}
                  rollRequest={rollRequest}
                  onRollResolved={onRollResolved}
                />
              </Suspense>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;

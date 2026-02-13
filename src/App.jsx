import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { MAX_DICE, buildDicePool, normalizeDiceCount } from "./lib/dice";
import {
  getBrowserStorage,
  loadPoolSelection,
  savePoolSelection,
} from "./lib/pool-persistence";
import {
  canPushCurrentRoll,
  transitionWithPush,
  transitionWithRoll,
} from "./lib/roll-session";
import {
  buildCountsWithStrain,
  incrementStrainPointsByBanes,
  normalizeStrainPoints,
} from "./lib/strain-points";

const MIN_ATTRIBUTE_DICE = 1;
const MIN_SKILL_DICE = 0;
const MAX_PREVIOUS_RESULTS = 10;
const DiceTray3D = lazy(() => import("./components/DiceTray3D"));

const formatRollSummary = (roll) => {
  if (!roll) {
    return "No results yet";
  }

  const withStrain = roll.outcomes.hasStrain ? " (with Strain)" : "";
  return `${roll.outcomes.successes} successes, ${roll.outcomes.banes} banes${withStrain}`;
};

function App() {
  const [storage] = useState(() => getBrowserStorage());
  const [initialPoolSelection] = useState(() => loadPoolSelection(storage));
  const [attributeDice, setAttributeDice] = useState(
    initialPoolSelection.attributeDice,
  );
  const [skillDice, setSkillDice] = useState(
    initialPoolSelection.skillDice,
  );
  const [strainPoints, setStrainPoints] = useState(0);
  const [currentRoll, setCurrentRoll] = useState(null);
  const [previousRoll, setPreviousRoll] = useState(null);
  const [recentResults, setRecentResults] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [rollRequest, setRollRequest] = useState(null);
  const rollRequestRef = useRef(null);
  const requestCounterRef = useRef(0);
  const currentRollRef = useRef(null);
  const previousRollRef = useRef(null);

  const normalizedStrainPoints = normalizeStrainPoints(strainPoints);
  const isRolling = Boolean(rollRequest);

  const onAttributeChange = (event) => {
    setAttributeDice(
      normalizeDiceCount(event.target.value, {
        min: MIN_ATTRIBUTE_DICE,
        max: MAX_DICE,
        fallback: MIN_ATTRIBUTE_DICE,
      }),
    );
  };

  const onSkillChange = (event) => {
    setSkillDice(
      normalizeDiceCount(event.target.value, {
        min: MIN_SKILL_DICE,
        max: MAX_DICE,
        fallback: MIN_SKILL_DICE,
      }),
    );
  };

  const onResetStrain = () => {
    setStrainPoints(0);
  };

  const onClearDice = () => {
    setCurrentRoll(null);
    setPreviousRoll(null);
    setRecentResults([]);
    setIsHistoryOpen(false);
    setRollRequest(null);
  };

  useEffect(() => {
    savePoolSelection(storage, {
      attributeDice,
      skillDice,
    });
  }, [storage, attributeDice, skillDice]);

  useEffect(() => {
    rollRequestRef.current = rollRequest;
  }, [rollRequest]);

  useEffect(() => {
    currentRollRef.current = currentRoll;
  }, [currentRoll]);

  useEffect(() => {
    previousRollRef.current = previousRoll;
  }, [previousRoll]);

  const onRoll = () => {
    if (isRolling) {
      return;
    }

    const dicePool = buildDicePool(
      buildCountsWithStrain(
        {
          attributeDice,
          skillDice,
        },
        normalizedStrainPoints,
      ),
    );

    requestCounterRef.current += 1;
    setRollRequest({
      key: requestCounterRef.current,
      action: "roll",
      dice: dicePool,
      rerollIds: dicePool.map((die) => die.id),
      startedAt: Date.now(),
    });
  };

  const onPush = () => {
    if (!canPush || isRolling) {
      return;
    }

    requestCounterRef.current += 1;
    setRollRequest({
      key: requestCounterRef.current,
      action: "push",
      dice: currentRoll?.dice ?? [],
      rerollIds: currentRoll?.pushableDiceIds ?? [],
      startedAt: Date.now(),
    });
  };

  const onRollResolved = useCallback((resolution) => {
    const activeRequest = rollRequestRef.current;

    if (!activeRequest || !resolution || resolution.key !== activeRequest.key) {
      return;
    }

    const resolvedRoll = { dice: Array.isArray(resolution.dice) ? resolution.dice : [] };
    const currentSession = {
      currentRoll: currentRollRef.current,
      previousRoll: previousRollRef.current,
    };
    const rolledAt = Number.isFinite(resolution.rolledAt) ? resolution.rolledAt : Date.now();
    let nextState = currentSession;

    if (resolution.action === "push") {
      nextState = transitionWithPush(currentSession, resolvedRoll, { rolledAt });
      const previousBanes = Number(currentSession.currentRoll?.outcomes?.banes ?? 0);
      const currentBanes = Number(nextState.currentRoll?.outcomes?.banes ?? 0);
      const firstPushFromRoll = currentSession.currentRoll?.action !== "push";
      const baneIncrease = firstPushFromRoll
        ? Math.max(0, currentBanes)
        : Math.max(0, currentBanes - previousBanes);

      setStrainPoints((current) => incrementStrainPointsByBanes(current, {
        outcomes: {
          banes: baneIncrease,
        },
      }));
    } else {
      nextState = transitionWithRoll(currentSession, resolvedRoll, { rolledAt });
    }

    setCurrentRoll(nextState.currentRoll);
    setPreviousRoll(nextState.previousRoll);
    if (nextState.currentRoll) {
      const entry = {
        id: `${resolution.key}-${rolledAt}`,
        summary: formatRollSummary(nextState.currentRoll),
      };
      setRecentResults((current) => [entry, ...current].slice(0, MAX_PREVIOUS_RESULTS + 1));
    }
    setRollRequest(null);
  }, []);

  useEffect(() => {
    if (recentResults.length <= 1 && isHistoryOpen) {
      setIsHistoryOpen(false);
    }
  }, [recentResults, isHistoryOpen]);

  const canPush = canPushCurrentRoll({ currentRoll, previousRoll })
    && !isRolling;
  const activeDice = rollRequest?.dice ?? currentRoll?.dice ?? [];
  const previousResults = recentResults.slice(1, MAX_PREVIOUS_RESULTS + 1);
  const hasPreviousResults = previousResults.length > 0;
  const pushableDiceCount = Number(currentRoll?.pushableDiceIds?.length ?? 0);
  const canClearDice = isRolling || activeDice.length > 0 || recentResults.length > 0;
  const hasRolled = Boolean(currentRoll);
  const primaryActionLabel = hasRolled ? `Push ${pushableDiceCount} Dice` : "Roll Dice";
  const isPrimaryActionDisabled = isRolling || (hasRolled && !canPush);
  const trayLead = isRolling
    ? (rollRequest?.action === "push" ? "Pushing selected dice..." : "Rolling dice...")
    : (currentRoll ? formatRollSummary(currentRoll) : "Roll the dice to see results.");
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
          <section className="panel controls-panel" aria-labelledby="dice-pool-label">
            <div className="panel-header">
              <h2 id="dice-pool-label">Dice Pool</h2>
            </div>
            <p className="panel-copy">
              Choose Attribute and Skill dice. Strain dice are added automatically from Strain Points.
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
                  ? (rollRequest?.action === "push" ? "Pushing..." : "Rolling...")
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
                      aria-label={isHistoryOpen ? "Hide previous results" : "Show previous results"}
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
              <Suspense fallback={<div className="tray-loading">Loading 3D tray…</div>}>
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

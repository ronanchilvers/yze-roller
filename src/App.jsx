import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const DiceTray3D = lazy(() => import("./components/DiceTray3D"));

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
  const [rollRequest, setRollRequest] = useState(null);
  const rollRequestRef = useRef(null);
  const requestCounterRef = useRef(0);
  const currentRollRef = useRef(null);
  const previousRollRef = useRef(null);

  const normalizedStrainPoints = normalizeStrainPoints(strainPoints);
  const totalDice = useMemo(
    () => attributeDice + skillDice + normalizedStrainPoints,
    [attributeDice, skillDice, normalizedStrainPoints],
  );
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

  const renderRollSummary = (roll) => {
    if (!roll) {
      return "No results yet";
    }

    const withStrain = roll.outcomes.hasStrain ? " (with Strain)" : "";
    return `${roll.outcomes.successes} successes, ${roll.outcomes.banes} banes${withStrain}`;
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
    setRollRequest(null);
  }, []);

  const canPush = canPushCurrentRoll({ currentRoll, previousRoll })
    && !isRolling;
  const activeDice = rollRequest?.dice ?? currentRoll?.dice ?? [];

  return (
    <main className="app-shell">
      <section className="dice-layout" aria-label="Year Zero dice roller">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Year Zero Engine</p>
            <h1>Dice Roller</h1>
          </div>
          <output className="strain-pill" aria-label="Current strain points">
            <span>Strain Points</span>
            <strong>{normalizedStrainPoints}</strong>
          </output>
        </header>

        <div className="content-grid">
          <section className="panel controls-panel" aria-labelledby="dice-pool-label">
            <h2 id="dice-pool-label">Dice Pool</h2>
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

              <div className="pool-summary" aria-live="polite">
                <p>Total Dice This Roll</p>
                <strong>{totalDice}</strong>
              </div>
            </div>

            <div className="actions">
              <button type="button" onClick={onRoll} disabled={isRolling}>
                {isRolling && rollRequest?.action === "roll" ? "Rolling..." : "Roll Dice"}
              </button>
              <button type="button" onClick={onPush} disabled={!canPush}>
                {isRolling && rollRequest?.action === "push" ? "Pushing..." : "Push (After Roll)"}
              </button>
            </div>
          </section>

          <section className="panel tray-panel" aria-labelledby="tray-label">
            <div className="tray-header">
              <h2 id="tray-label">Dice Tray</h2>
              <div className="tray-results" role="status" aria-live="polite">
                {isRolling ? (
                  <p className="tray-lead">
                    {rollRequest?.action === "push" ? "Pushing selected dice..." : "Rolling dice..."}
                  </p>
                ) : currentRoll ? (
                  <>
                    <p className="tray-lead">{renderRollSummary(currentRoll)}</p>
                    <p>
                      {canPush
                        ? `${currentRoll.pushableDiceIds.length} dice can be pushed.`
                        : "No dice can be pushed."}
                    </p>
                    <ul className="dice-readout">
                      {currentRoll.dice.map((die) => (
                        <li key={die.id}>
                          <span>{die.type}</span>
                          <strong>{die.face ?? "-"}</strong>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="tray-lead">Roll the dice to see results.</p>
                    <p>Results and roll breakdown will appear here.</p>
                  </>
                )}
              </div>
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
            {previousRoll ? <p className="previous-roll">Previous: {renderRollSummary(previousRoll)}</p> : null}
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;

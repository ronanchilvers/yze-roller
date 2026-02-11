import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { MAX_DICE, normalizeDiceCount, pushPool, rollPool } from "./lib/dice";
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

const MIN_ATTRIBUTE_DICE = 1;
const MIN_SKILL_DICE = 0;

function App() {
  const [storage] = useState(() => getBrowserStorage());
  const [initialPoolSelection] = useState(() => loadPoolSelection(storage));
  const [attributeDice, setAttributeDice] = useState(
    initialPoolSelection.attributeDice,
  );
  const [skillDice, setSkillDice] = useState(
    initialPoolSelection.skillDice,
  );
  const [strainPoints] = useState(0);
  const [currentRoll, setCurrentRoll] = useState(null);
  const [previousRoll, setPreviousRoll] = useState(null);

  const totalDice = useMemo(
    () => attributeDice + skillDice + strainPoints,
    [attributeDice, skillDice, strainPoints],
  );

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

  const onRoll = () => {
    const rolled = rollPool({
      attributeDice,
      skillDice,
      strainDice: strainPoints,
    });
    const nextState = transitionWithRoll(
      { currentRoll, previousRoll },
      rolled,
      { rolledAt: Date.now() },
    );

    setCurrentRoll(nextState.currentRoll);
    setPreviousRoll(nextState.previousRoll);
  };

  const onPush = () => {
    if (!canPush) {
      return;
    }

    const pushed = pushPool(currentRoll?.dice);
    const nextState = transitionWithPush(
      { currentRoll, previousRoll },
      pushed,
      { rolledAt: Date.now() },
    );

    setCurrentRoll(nextState.currentRoll);
    setPreviousRoll(nextState.previousRoll);
  };

  const renderRollSummary = (roll) => {
    if (!roll) {
      return "No results yet";
    }

    const withStrain = roll.outcomes.hasStrain ? " (with Strain)" : "";
    return `${roll.outcomes.successes} successes, ${roll.outcomes.banes} banes${withStrain}`;
  };

  const canPush = canPushCurrentRoll({ currentRoll, previousRoll });

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
            <strong>{strainPoints}</strong>
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
              <button type="button" onClick={onRoll}>
                Roll Dice
              </button>
              <button type="button" onClick={onPush} disabled={!canPush}>
                Push (After Roll)
              </button>
            </div>
          </section>

          <section className="panel tray-panel" aria-labelledby="tray-label">
            <h2 id="tray-label">Dice Tray</h2>
            <div className="tray-placeholder" role="status" aria-live="polite">
              {currentRoll ? (
                <>
                  <p className="tray-lead">{renderRollSummary(currentRoll)}</p>
                  <p>
                    {currentRoll.canPush
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
                  <p>3D dice tray will render here.</p>
                  <p>Ready for Attribute, Skill, and Strain dice.</p>
                </>
              )}
            </div>
            {previousRoll ? <p className="previous-roll">Previous: {renderRollSummary(previousRoll)}</p> : null}
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;

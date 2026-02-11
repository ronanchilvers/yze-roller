import { useMemo, useState } from "react";
import "./App.css";
import { MAX_DICE, normalizeDiceCount } from "./lib/dice";

const MIN_ATTRIBUTE_DICE = 1;
const MIN_SKILL_DICE = 0;

function App() {
  const [attributeDice, setAttributeDice] = useState(2);
  const [skillDice, setSkillDice] = useState(1);
  const [strainPoints] = useState(0);

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
              <button type="button">Roll Dice</button>
              <button type="button" disabled>
                Push (After Roll)
              </button>
            </div>
          </section>

          <section className="panel tray-panel" aria-labelledby="tray-label">
            <h2 id="tray-label">Dice Tray</h2>
            <div className="tray-placeholder" role="status" aria-live="polite">
              <p>3D dice tray will render here.</p>
              <p>Ready for Attribute, Skill, and Strain dice.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;

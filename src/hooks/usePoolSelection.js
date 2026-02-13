import { useEffect, useState } from "react";
import { MAX_DICE, normalizeDiceCount } from "../lib/dice.js";
import {
  getBrowserStorage,
  loadPoolSelection,
  savePoolSelection,
} from "../lib/pool-persistence.js";

const MIN_ATTRIBUTE_DICE = 1;
const MIN_SKILL_DICE = 0;

/**
 * Manages dice pool selection with localStorage persistence.
 * Handles attribute and skill dice counts with automatic save/load.
 *
 * @returns {{
 *   attributeDice: number,
 *   skillDice: number,
 *   setAttributeDice: (value: number) => void,
 *   setSkillDice: (value: number) => void,
 *   onAttributeChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
 *   onSkillChange: (event: React.ChangeEvent<HTMLInputElement>) => void
 * }}
 */
export const usePoolSelection = () => {
  const [storage] = useState(() => getBrowserStorage());
  const [initialPoolSelection] = useState(() => loadPoolSelection(storage));
  const [attributeDice, setAttributeDice] = useState(
    initialPoolSelection.attributeDice,
  );
  const [skillDice, setSkillDice] = useState(
    initialPoolSelection.skillDice,
  );

  useEffect(() => {
    savePoolSelection(storage, {
      attributeDice,
      skillDice,
    });
  }, [storage, attributeDice, skillDice]);

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

  return {
    attributeDice,
    skillDice,
    setAttributeDice,
    setSkillDice,
    onAttributeChange,
    onSkillChange,
  };
};
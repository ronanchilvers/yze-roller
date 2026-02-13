import { useEffect, useState } from "react";
import {
  ATTRIBUTE_DICE_OPTS,
  SKILL_DICE_OPTS,
  normalizeDiceCount,
} from "../lib/dice.js";
import {
  getBrowserStorage,
  loadPoolSelection,
  savePoolSelection,
} from "../lib/pool-persistence.js";

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
  const [skillDice, setSkillDice] = useState(initialPoolSelection.skillDice);

  useEffect(() => {
    savePoolSelection(storage, {
      attributeDice,
      skillDice,
    });
  }, [storage, attributeDice, skillDice]);

  const onAttributeChange = (event) => {
    setAttributeDice(
      normalizeDiceCount(event.target.value, ATTRIBUTE_DICE_OPTS),
    );
  };

  const onSkillChange = (event) => {
    setSkillDice(normalizeDiceCount(event.target.value, SKILL_DICE_OPTS));
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

import { useEffect, useState } from "react";
import {
  getBrowserStorage,
  loadPoolSelection,
  savePoolSelection,
} from "../lib/pool-persistence.js";

/**
 * Manages dice pool selection with localStorage persistence.
 * Handles attribute and skill dice counts with automatic save/load.
 * This hook takes no parameters.
 *
 * @returns {{
 *   attributeDice: number,
 *   skillDice: number,
 *   setAttributeDice: (value: number) => void,
 *   setSkillDice: (value: number) => void
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

  return {
    attributeDice,
    skillDice,
    setAttributeDice,
    setSkillDice,
  };
};

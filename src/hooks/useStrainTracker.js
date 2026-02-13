import { useState } from "react";
import {
  incrementStrainPointsByBanes,
  normalizeStrainPoints,
} from "../lib/strain-points.js";

/**
 * Manages strain points with automatic bane increment logic.
 * Strain points accumulate from banes rolled during push actions.
 *
 * @returns {{
 *   strainPoints: number,
 *   normalizedStrainPoints: number,
 *   setStrainPoints: (value: number | ((prev: number) => number)) => void,
 *   onResetStrain: () => void,
 *   applyBaneIncrement: (baneCount: number) => void
 * }}
 */
export const useStrainTracker = () => {
  const [strainPoints, setStrainPoints] = useState(0);

  const normalizedStrainPoints = normalizeStrainPoints(strainPoints);

  const onResetStrain = () => {
    setStrainPoints(0);
  };

  const applyBaneIncrement = (baneCount) => {
    setStrainPoints((current) =>
      incrementStrainPointsByBanes(current, {
        outcomes: {
          banes: baneCount,
        },
      }),
    );
  };

  return {
    strainPoints,
    normalizedStrainPoints,
    setStrainPoints,
    onResetStrain,
    applyBaneIncrement,
  };
};

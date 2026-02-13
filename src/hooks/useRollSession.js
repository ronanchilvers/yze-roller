import { useCallback, useEffect, useRef, useState } from "react";
import { buildDicePool } from "../lib/dice.js";
import {
  canPushCurrentRoll,
  transitionWithPush,
  transitionWithRoll,
} from "../lib/roll-session.js";
import { buildCountsWithStrain } from "../lib/strain-points.js";
import { useLatestRef } from "./useLatestRef.js";

const MAX_PREVIOUS_RESULTS = 10;

const formatRollSummary = (roll) => {
  if (!roll) {
    return "No results yet";
  }

  const withStrain = roll.outcomes.hasStrain ? " (with Strain)" : "";
  return `${roll.outcomes.successes} successes, ${roll.outcomes.banes} banes${withStrain}`;
};

/**
 * Manages roll session state including current/previous rolls, history, and roll requests.
 * Orchestrates the roll/push workflow and tracks roll history.
 *
 * @param {{
 *   attributeDice: number,
 *   skillDice: number,
 *   normalizedStrainPoints: number,
 *   onBaneIncrement: (baneCount: number) => void
 * }} options
 * @returns {{
 *   currentRoll: object | null,
 *   previousRoll: object | null,
 *   rollRequest: object | null,
 *   recentResults: Array<{ id: string, summary: string }>,
 *   isHistoryOpen: boolean,
 *   setIsHistoryOpen: (value: boolean) => void,
 *   isRolling: boolean,
 *   canPush: boolean,
 *   onRoll: () => void,
 *   onPush: () => void,
 *   onClearDice: () => void,
 *   onRollResolved: (resolution: object) => void
 * }}
 */
export const useRollSession = ({
  attributeDice,
  skillDice,
  normalizedStrainPoints,
  onBaneIncrement,
}) => {
  const [currentRoll, setCurrentRoll] = useState(null);
  const [previousRoll, setPreviousRoll] = useState(null);
  const [recentResults, setRecentResults] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [rollRequest, setRollRequest] = useState(null);
  const requestCounterRef = useRef(0);

  const rollRequestRef = useLatestRef(rollRequest);
  const currentRollRef = useLatestRef(currentRoll);
  const previousRollRef = useLatestRef(previousRoll);

  const isRolling = Boolean(rollRequest);

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

  const canPush = canPushCurrentRoll({ currentRoll, previousRoll }) && !isRolling;

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

  const onClearDice = () => {
    setCurrentRoll(null);
    setPreviousRoll(null);
    setRecentResults([]);
    setIsHistoryOpen(false);
    setRollRequest(null);
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

      onBaneIncrement(baneIncrease);
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
  }, [onBaneIncrement, rollRequestRef, currentRollRef, previousRollRef]);

  useEffect(() => {
    if (recentResults.length <= 1 && isHistoryOpen) {
      setIsHistoryOpen(false);
    }
  }, [recentResults, isHistoryOpen]);

  return {
    currentRoll,
    previousRoll,
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
  };
};
import { summarizeRoll } from "./dice.js";

const normalizeSession = (sessionState) => {
  const source = sessionState && typeof sessionState === "object" ? sessionState : {};

  return {
    currentRoll: source.currentRoll ?? null,
    previousRoll: source.previousRoll ?? null,
  };
};

export const createRollSnapshot = (rollResult, options = {}) => {
  if (!rollResult || typeof rollResult !== "object" || !Array.isArray(rollResult.dice)) {
    return null;
  }

  const summary = summarizeRoll(rollResult.dice);
  const rolledAt = Number.isFinite(options.rolledAt) ? options.rolledAt : Date.now();
  const action = options.action === "push" ? "push" : "roll";

  return {
    ...summary,
    action,
    rolledAt,
  };
};

export const transitionWithRoll = (sessionState, rollResult, options = {}) => {
  const snapshot = createRollSnapshot(rollResult, {
    action: "roll",
    rolledAt: options.rolledAt,
  });
  const normalizedSession = normalizeSession(sessionState);

  if (!snapshot) {
    return normalizedSession;
  }

  return {
    previousRoll: normalizedSession.currentRoll,
    currentRoll: snapshot,
  };
};

export const transitionWithPush = (sessionState, pushResult, options = {}) => {
  const normalizedSession = normalizeSession(sessionState);

  if (!normalizedSession.currentRoll || !normalizedSession.currentRoll.canPush) {
    return normalizedSession;
  }

  const snapshot = createRollSnapshot(pushResult, {
    action: "push",
    rolledAt: options.rolledAt,
  });

  if (!snapshot) {
    return normalizedSession;
  }

  return {
    previousRoll: normalizedSession.currentRoll,
    currentRoll: snapshot,
  };
};

export const canPushCurrentRoll = (sessionState) => {
  const normalizedSession = normalizeSession(sessionState);
  return Boolean(normalizedSession.currentRoll?.canPush);
};

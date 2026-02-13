import { summarizeRoll } from "./dice.js";

/**
 * Validates the shape of a rollRequest object from useRollSession.
 * Guards against malformed objects that could cause silent failures or
 * unexpected physics behavior in DiceTray3D.
 *
 * @param {unknown} rollRequest - The request object to validate
 * @returns {boolean} True if the request has valid shape, false otherwise
 */
export const isValidRollRequest = (rollRequest) => {
  if (!rollRequest || typeof rollRequest !== "object") {
    return false;
  }

  // key must be defined (used for request correlation)
  if (rollRequest.key === undefined) {
    return false;
  }

  // dice must be an array (even if empty)
  if (!Array.isArray(rollRequest.dice)) {
    return false;
  }

  // action must be "roll" or "push"
  if (rollRequest.action !== "roll" && rollRequest.action !== "push") {
    return false;
  }

  // rerollIds must be an array of strings
  if (!Array.isArray(rollRequest.rerollIds)) {
    return false;
  }

  if (!rollRequest.rerollIds.every((id) => typeof id === "string")) {
    return false;
  }

  return true;
};

/**
 * Validates the shape of a resolution object passed to onRollResolved.
 * Guards against malformed payloads from the physics simulation.
 *
 * @param {unknown} resolution - The resolution object to validate
 * @returns {boolean} True if the resolution has valid shape, false otherwise
 */
export const isValidResolution = (resolution) => {
  if (!resolution || typeof resolution !== "object") {
    return false;
  }

  // key must be defined (used for request correlation)
  if (resolution.key === undefined) {
    return false;
  }

  // dice must be an array (even if empty)
  if (!Array.isArray(resolution.dice)) {
    return false;
  }

  // action must be "roll" or "push"
  if (resolution.action !== "roll" && resolution.action !== "push") {
    return false;
  }

  return true;
};

const normalizeSession = (sessionState) => {
  const source =
    sessionState && typeof sessionState === "object" ? sessionState : {};

  return {
    currentRoll: source.currentRoll ?? null,
    previousRoll: source.previousRoll ?? null,
  };
};

export const createRollSnapshot = (rollResult, options = {}) => {
  if (
    !rollResult ||
    typeof rollResult !== "object" ||
    !Array.isArray(rollResult.dice)
  ) {
    return null;
  }

  const summary = summarizeRoll(rollResult.dice);
  const rolledAt = Number.isFinite(options.rolledAt)
    ? options.rolledAt
    : Date.now();
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

  if (
    !normalizedSession.currentRoll ||
    !normalizedSession.currentRoll.canPush
  ) {
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

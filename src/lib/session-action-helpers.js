export const MAX_SUBMITTED_SESSION_ACTIONS = 100;

export const normalizeOutcomeCount = (value) => {
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 99) {
    return null;
  }

  return numeric;
};

export const buildSessionActionRequest = (roll) => {
  if (!roll || typeof roll !== "object") {
    return null;
  }

  const successes = normalizeOutcomeCount(roll?.outcomes?.successes);
  const banes = normalizeOutcomeCount(roll?.outcomes?.banes);

  if (successes === null || banes === null) {
    return null;
  }

  if (roll.action === "push") {
    return {
      action: "push",
      payload: {
        successes,
        banes,
        strain: Boolean(roll?.outcomes?.hasStrain),
      },
    };
  }

  return {
    action: "roll",
    payload: {
      successes,
      banes,
    },
  };
};

export const getCurrentRollActionId = (currentRoll, recentResults) => {
  if (!currentRoll) {
    return null;
  }

  if (typeof recentResults?.[0]?.id === "string" && recentResults[0].id.trim()) {
    return recentResults[0].id.trim();
  }

  if (Number.isFinite(currentRoll.rolledAt)) {
    return `${currentRoll.action ?? "roll"}-${currentRoll.rolledAt}`;
  }

  return null;
};

export const normalizeActionErrorMessage = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

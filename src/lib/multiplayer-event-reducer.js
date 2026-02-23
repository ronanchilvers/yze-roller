const isObjectLike = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeNonNegativeInteger = (value, fallback = null) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.floor(numeric);
};

const normalizeRole = (value) =>
  value === "gm" || value === "player" ? value : null;

const normalizeDisplayName = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const buildPlayerFromEvent = (event) => {
  if (!isObjectLike(event)) {
    return null;
  }

  const actor = isObjectLike(event.actor) ? event.actor : {};
  const payload = isObjectLike(event.payload) ? event.payload : {};
  const tokenId = normalizeNonNegativeInteger(
    payload.token_id ?? actor.token_id,
    null,
  );
  const role = normalizeRole(payload.role ?? actor.role);
  const displayName = normalizeDisplayName(
    payload.display_name ?? actor.display_name,
  );

  if (tokenId === null || !role || !displayName) {
    return null;
  }

  return {
    tokenId,
    role,
    displayName,
  };
};

const upsertPlayer = (players, nextPlayer) => {
  if (!nextPlayer) {
    return players;
  }

  const existingIndex = players.findIndex(
    (player) => player.tokenId === nextPlayer.tokenId,
  );

  if (existingIndex === -1) {
    return [...players, nextPlayer];
  }

  const updatedPlayers = [...players];
  updatedPlayers[existingIndex] = {
    ...updatedPlayers[existingIndex],
    ...nextPlayer,
  };
  return updatedPlayers;
};

const removePlayerByTokenId = (players, tokenId) => {
  if (!Number.isFinite(tokenId) || tokenId < 0) {
    return players;
  }

  return players.filter((player) => player.tokenId !== tokenId);
};

const hasEventId = (events, eventId) =>
  events.some((event) => normalizeNonNegativeInteger(event?.id, -1) === eventId);

const appendEvent = (events, event) => [...events, event];

const applySceneStrainFromPayload = (currentSceneStrain, payload, fallback = null) => {
  const nextSceneStrain = normalizeNonNegativeInteger(payload?.scene_strain, fallback);

  if (nextSceneStrain === null) {
    return currentSceneStrain;
  }

  return nextSceneStrain;
};

export const applySessionEvent = (sessionState, eventInput) => {
  if (!isObjectLike(sessionState) || !isObjectLike(eventInput)) {
    return sessionState;
  }

  const eventId = normalizeNonNegativeInteger(eventInput.id, -1);

  if (eventId < 0 || hasEventId(sessionState.events, eventId)) {
    return sessionState;
  }

  const eventType = typeof eventInput.type === "string" ? eventInput.type : "";
  const payload = isObjectLike(eventInput.payload) ? eventInput.payload : {};
  let nextPlayers = sessionState.players;
  let nextSceneStrain = sessionState.sceneStrain;

  if (eventType === "push") {
    nextSceneStrain = applySceneStrainFromPayload(
      sessionState.sceneStrain,
      payload,
      null,
    );
  }

  if (eventType === "strain_reset") {
    nextSceneStrain = applySceneStrainFromPayload(
      sessionState.sceneStrain,
      payload,
      0,
    );
  }

  if (eventType === "join") {
    nextPlayers = upsertPlayer(sessionState.players, buildPlayerFromEvent(eventInput));
  }

  if (eventType === "leave") {
    const tokenId = normalizeNonNegativeInteger(
      payload.token_id ?? eventInput?.actor?.token_id,
      -1,
    );
    nextPlayers = removePlayerByTokenId(sessionState.players, tokenId);
  }

  return {
    ...sessionState,
    events: appendEvent(sessionState.events, eventInput),
    players: nextPlayers,
    sceneStrain: nextSceneStrain,
    latestEventId: Math.max(sessionState.latestEventId, eventId),
  };
};

export const applySessionEvents = (sessionState, events) => {
  if (!Array.isArray(events) || !events.length) {
    return sessionState;
  }

  return events.reduce(applySessionEvent, sessionState);
};

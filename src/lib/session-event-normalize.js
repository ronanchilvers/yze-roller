export const MAX_VISIBLE_SESSION_EVENTS = 20;
export const MAX_TRACKED_SESSION_ROLL_TOAST_EVENTS = 200;

export const normalizeSessionEventId = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.floor(numeric);
};

export const normalizeSessionEventType = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
};

export const normalizeSessionEventCount = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.floor(numeric);
};

export const normalizeSessionPlayerTokenId = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.floor(numeric);
};

export const normalizeSessionPlayerDisplayName = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

export const normalizeSessionPlayersForGmPanel = (playersInput) => {
  if (!Array.isArray(playersInput)) {
    return [];
  }

  return playersInput
    .map((player) => {
      const tokenId = normalizeSessionPlayerTokenId(player?.tokenId);
      const displayName = normalizeSessionPlayerDisplayName(player?.displayName);
      const role = player?.role === "gm" || player?.role === "player"
        ? player.role
        : "player";

      if (tokenId === null || !displayName) {
        return null;
      }

      return {
        tokenId,
        displayName,
        role,
      };
    })
    .filter(Boolean);
};

export const normalizeSessionEventActorLabel = (event) => {
  const displayName = event?.actor?.display_name;
  if (typeof displayName === "string" && displayName.trim()) {
    return displayName.trim();
  }

  const tokenId = normalizeSessionEventId(event?.actor?.token_id);
  if (tokenId !== null) {
    return `Player ${tokenId}`;
  }

  const payloadName = event?.payload?.display_name;
  if (typeof payloadName === "string" && payloadName.trim()) {
    return payloadName.trim();
  }

  return "Player";
};

export const normalizeSessionEventActorDisplayName = (event) => {
  const actorDisplayName = event?.actor?.display_name;
  if (typeof actorDisplayName === "string" && actorDisplayName.trim()) {
    return actorDisplayName.trim();
  }

  const payloadDisplayName = event?.payload?.display_name;
  if (typeof payloadDisplayName === "string" && payloadDisplayName.trim()) {
    return payloadDisplayName.trim();
  }

  return "";
};

export const normalizeSessionEventBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return null;
};

export const normalizeSessionEventHasStrain = (payload) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const explicitCandidates = [
    payload.strain,
    payload.has_strain,
    payload.hasStrain,
    payload.with_strain,
    payload.withStrain,
    payload?.outcomes?.strain,
    payload?.outcomes?.has_strain,
    payload?.outcomes?.hasStrain,
  ];

  for (const candidate of explicitCandidates) {
    const normalized = normalizeSessionEventBoolean(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }

  return normalizeSessionEventCount(payload.scene_strain) > 0;
};

export const isSessionRollEventFromSelf = (
  event,
  selfTokenId,
  selfDisplayName,
) => {
  const actorTokenId = normalizeSessionEventId(event?.actor?.token_id);

  if (selfTokenId !== null && actorTokenId !== null) {
    return selfTokenId === actorTokenId;
  }

  if (!selfDisplayName) {
    return false;
  }

  const actorDisplayName = normalizeSessionEventActorDisplayName(event);
  if (!actorDisplayName) {
    return false;
  }

  return actorDisplayName.toLowerCase() === selfDisplayName.toLowerCase();
};

export const buildSessionEventSummary = (event) => {
  const eventType = normalizeSessionEventType(event?.type);
  const payload = event && typeof event.payload === "object" && event.payload
    ? event.payload
    : {};
  const actorLabel = normalizeSessionEventActorLabel(event);
  const successes = normalizeSessionEventCount(payload.successes);
  const banes = normalizeSessionEventCount(payload.banes);

  if (eventType === "roll") {
    return `${actorLabel} rolled ${successes} successes, ${banes} banes.`;
  }

  if (eventType === "push") {
    return `${actorLabel} pushed to ${successes} successes, ${banes} banes.`;
  }

  if (eventType === "join") {
    return `${actorLabel} joined the session.`;
  }

  if (eventType === "leave") {
    return `${actorLabel} left the session.`;
  }

  if (eventType === "strain_reset") {
    return "Strain points were reset.";
  }

  return "Session event received.";
};

export const normalizeSessionEventsForFeed = (eventsInput) => {
  if (!Array.isArray(eventsInput)) {
    return [];
  }

  const eventMap = new Map();

  for (const event of eventsInput) {
    if (!event || typeof event !== "object") {
      continue;
    }

    const eventId = normalizeSessionEventId(event.id);
    if (eventId === null || eventMap.has(eventId)) {
      continue;
    }

    eventMap.set(eventId, {
      id: eventId,
      type: normalizeSessionEventType(event.type),
      summary: buildSessionEventSummary(event),
    });
  }

  return Array.from(eventMap.values()).slice(-MAX_VISIBLE_SESSION_EVENTS);
};

export const normalizeSessionText = (value, fallback) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
};

export const normalizeSessionCount = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.floor(numeric);
};

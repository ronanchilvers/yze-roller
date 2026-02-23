const isObjectLike = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizePositiveInteger = (value, fallback = null) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }

  return Math.floor(numeric);
};

const normalizeNonNegativeInteger = (value, fallback = 0) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return fallback;
  }

  return Math.floor(numeric);
};

const normalizeRole = (value) =>
  value === "gm" || value === "player" ? value : null;

const normalizeJoiningEnabled = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  return value.trim().toLowerCase() === "true";
};

const normalizePlayerSummary = (value) => {
  if (!isObjectLike(value)) {
    return null;
  }

  const tokenId = normalizePositiveInteger(value.token_id);
  const role = normalizeRole(value.role);
  const displayName = normalizeString(value.display_name);

  if (!tokenId || !role || !displayName) {
    return null;
  }

  return {
    tokenId,
    role,
    displayName,
  };
};

/**
 * @param {unknown} payload
 * @returns {{
 *   sessionId: number,
 *   sessionName: string,
 *   joiningEnabled: boolean,
 *   role: "gm" | "player",
 *   self: { tokenId: number, role: "gm" | "player", displayName: string } | null,
 *   sceneStrain: number,
 *   latestEventId: number,
 *   sinceId: number,
 *   players: Array<{ tokenId: number, role: "gm" | "player", displayName: string }>,
 * }}
 */
export const normalizeSessionSnapshot = (payload) => {
  if (!isObjectLike(payload)) {
    throw new Error("Session snapshot must be an object.");
  }

  const sessionId = normalizePositiveInteger(payload.session_id);
  const role = normalizeRole(payload.role);

  if (!sessionId) {
    throw new Error("Session snapshot is missing a valid session_id.");
  }

  if (!role) {
    throw new Error("Session snapshot is missing a valid role.");
  }

  const players = Array.isArray(payload.players)
    ? payload.players.map(normalizePlayerSummary).filter(Boolean)
    : [];
  const normalizedSelf = normalizePlayerSummary(payload.self);
  const latestEventId = normalizeNonNegativeInteger(payload.latest_event_id, 0);

  return {
    sessionId,
    sessionName: normalizeString(payload.session_name),
    joiningEnabled: normalizeJoiningEnabled(payload.joining_enabled),
    role,
    self: normalizedSelf,
    sceneStrain: normalizeNonNegativeInteger(payload.scene_strain, 0),
    latestEventId,
    sinceId: latestEventId,
    players,
  };
};

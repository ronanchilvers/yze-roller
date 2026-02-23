const normalizeSessionToken = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeSessionId = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.floor(numeric);
};

let sessionAuthState = null;

/**
 * Stores session auth in process memory only.
 *
 * @param {{
 *   sessionToken?: string | null,
 *   sessionId?: number | null,
 *   role?: "gm" | "player" | null,
 *   self?: unknown,
 * } | null} nextAuth
 * @returns {{
 *   sessionToken: string,
 *   sessionId: number | null,
 *   role: "gm" | "player" | null,
 *   self: unknown,
 * } | null}
 */
export const setSessionAuth = (nextAuth) => {
  if (!nextAuth || typeof nextAuth !== "object") {
    sessionAuthState = null;
    return null;
  }

  const sessionToken = normalizeSessionToken(nextAuth.sessionToken);

  if (!sessionToken) {
    sessionAuthState = null;
    return null;
  }

  const role =
    nextAuth.role === "gm" || nextAuth.role === "player" ? nextAuth.role : null;

  sessionAuthState = {
    sessionToken,
    sessionId: normalizeSessionId(nextAuth.sessionId),
    role,
    self: nextAuth.self ?? null,
  };

  return { ...sessionAuthState };
};

export const getSessionAuth = () =>
  sessionAuthState ? { ...sessionAuthState } : null;

export const clearSessionAuth = () => {
  sessionAuthState = null;
};

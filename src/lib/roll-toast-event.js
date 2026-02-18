export const ROLL_TOAST_DEDUPE_BUCKET_MS = 1000;

const normalizeString = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizeEventId = (value) => {
  const nextValue = normalizeString(value);
  return nextValue ? nextValue : null;
};

const normalizeAction = (value) => {
  return value === "push" ? "push" : "roll";
};

const normalizeSource = (value) => {
  return value === "remote" ? "remote" : "local";
};

const normalizeCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.floor(numeric));
};

const normalizeOccurredAt = (value) => {
  if (!Number.isFinite(value) || value <= 0) {
    return Date.now();
  }

  return Math.floor(value);
};

/**
 * Normalizes incoming roll event payloads from local and remote sources.
 * Uses non-throwing defaults so malformed external payloads degrade safely.
 *
 * @param {unknown} input
 * @returns {{
 *   eventId: string | null,
 *   source: "local" | "remote",
 *   actorId: string,
 *   actorName: string,
 *   action: "roll" | "push",
 *   successes: number,
 *   banes: number,
 *   hasStrain: boolean,
 *   occurredAt: number,
 * }}
 */
export const normalizeRollToastEvent = (input) => {
  const source = input && typeof input === "object" ? input : {};

  const normalized = {
    eventId: normalizeEventId(source.eventId),
    source: normalizeSource(source.source),
    actorId: normalizeString(source.actorId),
    actorName: normalizeString(source.actorName),
    action: normalizeAction(source.action),
    successes: normalizeCount(source.successes),
    banes: normalizeCount(source.banes),
    hasStrain: Boolean(source.hasStrain),
    occurredAt: normalizeOccurredAt(source.occurredAt),
  };

  return normalized;
};

/**
 * Builds a stable dedupe key for roll toast emission.
 * Uses explicit eventId when available, otherwise buckets by timestamp.
 *
 * @param {unknown} event
 * @returns {string}
 */
export const getRollToastDedupKey = (event) => {
  const normalized = normalizeRollToastEvent(event);

  if (normalized.eventId) {
    return `event:${normalized.eventId}`;
  }

  const actorSegment =
    normalized.source === "remote"
      ? normalized.actorId || normalized.actorName || "unknown"
      : "local";
  const timeBucket = Math.floor(
    normalized.occurredAt / ROLL_TOAST_DEDUPE_BUCKET_MS,
  );

  return [
    "roll-toast",
    normalized.source,
    actorSegment,
    normalized.action,
    `s${normalized.successes}`,
    `b${normalized.banes}`,
    normalized.hasStrain ? "strain" : "clean",
    `t${timeBucket}`,
  ].join("|");
};

/**
 * Builds toast content from normalized roll event data.
 *
 * @param {unknown} event
 * @returns {{
 *   title: string,
 *   message: string,
 *   breakdown: string,
 *   total: string,
 *   source: "local" | "remote",
 *   actorId: string,
 *   action: "roll" | "push",
 *   occurredAt: number,
 * }}
 */
export const buildRollToastPayload = (event) => {
  const normalized = normalizeRollToastEvent(event);
  const withStrain = normalized.hasStrain ? " (with Strain)" : "";
  const summary = `${normalized.successes} successes, ${normalized.banes} banes${withStrain}`;

  const title =
    normalized.source === "remote"
      ? `${normalized.actorId || "Another player"} ${
          normalized.action === "push" ? "pushed" : "rolled"
        }`
      : normalized.action === "push"
        ? "Push Result"
        : "Roll Result";

  return {
    title,
    message: summary,
    breakdown: summary,
    total: String(normalized.successes),
    source: normalized.source,
    actorId: normalized.actorId,
    action: normalized.action,
    occurredAt: normalized.occurredAt,
  };
};


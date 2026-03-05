import assert from "node:assert/strict";
import { test, vi } from "vitest";
import {
  ROLL_TOAST_DEDUPE_BUCKET_MS,
  buildRollToastPayload,
  formatRollHistorySummary,
  formatRollOutcomeSummary,
  getRollToastDedupKey,
  normalizeRollToastEvent,
} from "./roll-toast-event.js";

test("normalizeRollToastEvent normalizes a valid local event", () => {
  const normalized = normalizeRollToastEvent({
    eventId: "local-1",
    source: "local",
    action: "roll",
    successes: 3,
    banes: 1,
    hasStrain: false,
    occurredAt: 12345,
  });

  assert.deepEqual(normalized, {
    eventId: "local-1",
    source: "local",
    actorId: "",
    actorName: "",
    action: "roll",
    rollTypeLabel: "",
    successes: 3,
    banes: 1,
    hasStrain: false,
    occurredAt: 12345,
  });
});

test("normalizeRollToastEvent normalizes valid remote actor data", () => {
  const normalized = normalizeRollToastEvent({
    source: "remote",
    actorId: "Player-42",
    actorName: "Alex",
    action: "push",
    rollTypeLabel: "Scout (Wits)",
    successes: 4.9,
    banes: 0.2,
    hasStrain: 1,
    occurredAt: 98765.9,
  });

  assert.deepEqual(normalized, {
    eventId: null,
    source: "remote",
    actorId: "Player-42",
    actorName: "Alex",
    action: "push",
    rollTypeLabel: "Scout (Wits)",
    successes: 4,
    banes: 0,
    hasStrain: true,
    occurredAt: 98765,
  });
});

test("normalizeRollToastEvent applies non-throwing fallbacks for malformed input", () => {
  const nowSpy = vi.spyOn(Date, "now").mockReturnValue(5000);

  const normalized = normalizeRollToastEvent({
    source: "unknown",
    eventId: "   ",
    actorId: 42,
    actorName: null,
    action: "unknown",
    successes: "bad",
    banes: -3,
    hasStrain: "",
    occurredAt: NaN,
  });

  assert.deepEqual(normalized, {
    eventId: null,
    source: "local",
    actorId: "",
    actorName: "",
    action: "roll",
    rollTypeLabel: "",
    successes: 0,
    banes: 0,
    hasStrain: false,
    occurredAt: 5000,
  });

  nowSpy.mockRestore();
});

test("getRollToastDedupKey uses explicit event id when available", () => {
  const key = getRollToastDedupKey({
    eventId: "remote-abc",
    source: "remote",
    actorId: "p1",
    action: "push",
    successes: 5,
    banes: 2,
    occurredAt: 11111,
  });

  assert.equal(key, "event:remote-abc");
});

test("getRollToastDedupKey is stable and unique across different buckets", () => {
  const baseEvent = {
    source: "remote",
    actorId: "p1",
    action: "roll",
    successes: 2,
    banes: 1,
    hasStrain: false,
  };

  const first = getRollToastDedupKey({
    ...baseEvent,
    occurredAt: 4000,
  });
  const second = getRollToastDedupKey({
    ...baseEvent,
    occurredAt: 4000 + ROLL_TOAST_DEDUPE_BUCKET_MS - 1,
  });
  const third = getRollToastDedupKey({
    ...baseEvent,
    occurredAt: 4000 + ROLL_TOAST_DEDUPE_BUCKET_MS,
  });

  assert.equal(first, second);
  assert.notEqual(first, third);
});

test("getRollToastDedupKey differs for different roll types in the same bucket", () => {
  const baseEvent = {
    source: "local",
    action: "roll",
    successes: 2,
    banes: 1,
    hasStrain: false,
    occurredAt: 4000,
  };

  const sneakKey = getRollToastDedupKey({
    ...baseEvent,
    rollTypeLabel: "Sneak (Agility)",
  });
  const hoodwinkKey = getRollToastDedupKey({
    ...baseEvent,
    rollTypeLabel: "Hoodwink (Empathy)",
  });

  assert.notEqual(sneakKey, hoodwinkKey);
});

test("buildRollToastPayload formats local roll and push messages", () => {
  const rolled = buildRollToastPayload({
    source: "local",
    action: "roll",
    successes: 3,
    banes: 2,
    hasStrain: false,
    occurredAt: 999,
  });
  const pushed = buildRollToastPayload({
    source: "local",
    action: "push",
    successes: 1,
    banes: 1,
    hasStrain: true,
    occurredAt: 1000,
  });

  assert.equal(rolled.title, "Roll Result");
  assert.equal(rolled.breakdown, "3 successes, 2 banes");
  assert.equal(rolled.total, "3");

  assert.equal(pushed.title, "Push Result");
  assert.equal(pushed.breakdown, "1 successes, 1 banes (with Strain)");
  assert.equal(pushed.total, "1");
});

test("buildRollToastPayload prefixes the roll type in the message when provided", () => {
  const payload = buildRollToastPayload({
    source: "local",
    action: "roll",
    rollTypeLabel: "Sneak (Agility)",
    successes: 3,
    banes: 2,
    hasStrain: false,
    occurredAt: 999,
  });

  assert.equal(payload.title, "Roll Result");
  assert.equal(payload.message, "Sneak (Agility) - 3 successes, 2 banes");
  assert.equal(payload.breakdown, "Sneak (Agility) - 3 successes, 2 banes");
});

test("formatRollOutcomeSummary uses a consistent successes/banes format", () => {
  assert.equal(
    formatRollOutcomeSummary({
      successes: 3,
      banes: 2,
      hasStrain: false,
    }),
    "3 successes, 2 banes",
  );

  assert.equal(
    formatRollOutcomeSummary({
      successes: "1.9",
      banes: 1,
      hasStrain: true,
    }),
    "1 successes, 1 banes (with Strain)",
  );
});

test("formatRollHistorySummary prefixes roll and push outcomes", () => {
  assert.equal(
    formatRollHistorySummary({
      action: "roll",
      successes: 2,
      banes: 0,
      hasStrain: false,
    }),
    "Roll result - 2 successes, 0 banes",
  );

  assert.equal(
    formatRollHistorySummary({
      action: "push",
      successes: 1,
      banes: 3,
      hasStrain: true,
    }),
    "Push result - 1 successes, 3 banes (with Strain)",
  );
});

test("formatRollHistorySummary includes roll type when provided", () => {
  assert.equal(
    formatRollHistorySummary({
      action: "roll",
      rollTypeLabel: "Hoodwink (Empathy)",
      successes: 2,
      banes: 1,
      hasStrain: false,
    }),
    "Roll result - Hoodwink (Empathy) - 2 successes, 1 banes",
  );
});

test("buildRollToastPayload formats remote actor titles using actorId", () => {
  const remote = buildRollToastPayload({
    source: "remote",
    actorId: "Watcher",
    action: "push",
    successes: 2,
    banes: 0,
    hasStrain: false,
    occurredAt: 2222,
  });
  const fallbackActor = buildRollToastPayload({
    source: "remote",
    actorId: "",
    action: "roll",
    successes: 0,
    banes: 3,
    hasStrain: true,
    occurredAt: 3333,
  });

  assert.equal(remote.title, "Watcher pushed");
  assert.equal(remote.breakdown, "2 successes, 0 banes");
  assert.equal(remote.total, "2");

  assert.equal(fallbackActor.title, "Another player rolled");
  assert.equal(fallbackActor.breakdown, "0 successes, 3 banes (with Strain)");
});

import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildSessionEventSummary,
  isSessionRollEventFromSelf,
  MAX_VISIBLE_SESSION_EVENTS,
  normalizeSessionCount,
  normalizeSessionEventHasStrain,
  normalizeSessionEventId,
  normalizeSessionEventsForFeed,
  normalizeSessionPlayersForGmPanel,
  normalizeSessionText,
} from "./session-event-normalize.js";

test("normalizeSessionEventId floors valid values and rejects invalid", () => {
  assert.equal(normalizeSessionEventId(12.9), 12);
  assert.equal(normalizeSessionEventId("7"), 7);
  assert.equal(normalizeSessionEventId(-1), null);
  assert.equal(normalizeSessionEventId("abc"), null);
});

test("normalizeSessionPlayersForGmPanel filters invalid rows", () => {
  assert.deepEqual(
    normalizeSessionPlayersForGmPanel([
      { tokenId: 10, displayName: " Alice ", role: "player" },
      { tokenId: 0, displayName: "Ghost", role: "player" },
      { tokenId: 20, displayName: "", role: "player" },
      { tokenId: 30, displayName: "Host", role: "invalid" },
    ]),
    [
      { tokenId: 10, displayName: "Alice", role: "player" },
      { tokenId: 30, displayName: "Host", role: "player" },
    ],
  );
});

test("normalizeSessionEventHasStrain prioritizes explicit flags", () => {
  assert.equal(normalizeSessionEventHasStrain({ has_strain: "yes" }), true);
  assert.equal(normalizeSessionEventHasStrain({ hasStrain: "no" }), false);
  assert.equal(normalizeSessionEventHasStrain({ scene_strain: 2 }), true);
  assert.equal(normalizeSessionEventHasStrain({ scene_strain: 0 }), false);
});

test("isSessionRollEventFromSelf matches token id or display name", () => {
  assert.equal(
    isSessionRollEventFromSelf(
      { actor: { token_id: 9, display_name: "Alice" } },
      9,
      "",
    ),
    true,
  );

  assert.equal(
    isSessionRollEventFromSelf(
      { actor: { display_name: "ALICE" } },
      null,
      "alice",
    ),
    true,
  );

  assert.equal(
    isSessionRollEventFromSelf(
      { actor: { token_id: 7, display_name: "Bob" } },
      9,
      "Alice",
    ),
    false,
  );
});

test("buildSessionEventSummary formats known event types", () => {
  assert.equal(
    buildSessionEventSummary({
      type: "roll",
      actor: { display_name: "Alice" },
      payload: { successes: 2, banes: 1 },
    }),
    "Alice rolled 2 successes, 1 banes.",
  );

  assert.equal(
    buildSessionEventSummary({
      type: "strain_reset",
    }),
    "Strain points were reset.",
  );
});

test("normalizeSessionEventsForFeed de-duplicates and caps visible events", () => {
  const events = [
    { id: 1, type: "join", actor: { token_id: 1 } },
    { id: 1, type: "join", actor: { token_id: 1 } },
  ];

  for (let index = 2; index <= MAX_VISIBLE_SESSION_EVENTS + 5; index += 1) {
    events.push({ id: index, type: "roll", payload: { successes: index, banes: 0 } });
  }

  const feed = normalizeSessionEventsForFeed(events);

  assert.equal(feed.length, MAX_VISIBLE_SESSION_EVENTS);
  assert.equal(feed[0].id, 6);
  assert.equal(feed.at(-1)?.id, MAX_VISIBLE_SESSION_EVENTS + 5);
});

test("normalizeSessionText and normalizeSessionCount use safe fallbacks", () => {
  assert.equal(normalizeSessionText("  hello  ", "fallback"), "hello");
  assert.equal(normalizeSessionText(" ", "fallback"), "fallback");
  assert.equal(normalizeSessionCount(8.9), 8);
  assert.equal(normalizeSessionCount(-1), 0);
});

import assert from "node:assert/strict";
import { test } from "vitest";
import { normalizeSessionSnapshot } from "./session-snapshot.js";

test("normalizeSessionSnapshot normalizes a valid payload", () => {
  const normalized = normalizeSessionSnapshot({
    session_id: 7,
    session_name: " Streetwise Night ",
    joining_enabled: true,
    role: "player",
    self: {
      token_id: 31,
      display_name: "Alice",
      role: "player",
    },
    scene_strain: 3,
    latest_event_id: 130,
    players: [
      {
        token_id: 31,
        display_name: "Alice",
        role: "player",
      },
      {
        token_id: 1,
        display_name: "GM",
        role: "gm",
      },
    ],
  });

  assert.deepEqual(normalized, {
    sessionId: 7,
    sessionName: "Streetwise Night",
    joiningEnabled: true,
    role: "player",
    self: {
      tokenId: 31,
      displayName: "Alice",
      role: "player",
    },
    sceneStrain: 3,
    latestEventId: 130,
    sinceId: 130,
    players: [
      {
        tokenId: 31,
        displayName: "Alice",
        role: "player",
      },
      {
        tokenId: 1,
        displayName: "GM",
        role: "gm",
      },
    ],
  });
});

test("normalizeSessionSnapshot defaults latest_event_id and strain safely", () => {
  const normalized = normalizeSessionSnapshot({
    session_id: 8,
    session_name: "Empty",
    joining_enabled: "false",
    role: "gm",
    self: null,
    scene_strain: "bad",
    latest_event_id: null,
    players: null,
  });

  assert.equal(normalized.sceneStrain, 0);
  assert.equal(normalized.latestEventId, 0);
  assert.equal(normalized.sinceId, 0);
  assert.equal(normalized.joiningEnabled, false);
  assert.deepEqual(normalized.players, []);
  assert.equal(normalized.self, null);
});

test("normalizeSessionSnapshot throws for missing required session fields", () => {
  assert.throws(() => normalizeSessionSnapshot(null), /must be an object/);
  assert.throws(
    () =>
      normalizeSessionSnapshot({
        session_id: 0,
        role: "player",
      }),
    /session_id/,
  );
  assert.throws(
    () =>
      normalizeSessionSnapshot({
        session_id: 1,
        role: "invalid",
      }),
    /role/,
  );
});

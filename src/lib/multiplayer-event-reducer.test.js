import assert from "node:assert/strict";
import { test } from "vitest";
import {
  applySessionEvent,
  applySessionEvents,
} from "./multiplayer-event-reducer.js";

const createSessionState = (overrides = {}) => ({
  events: [],
  players: [],
  sceneStrain: 0,
  latestEventId: 0,
  ...overrides,
});

test("applySessionEvent appends roll events and advances latestEventId", () => {
  const nextState = applySessionEvent(
    createSessionState(),
    {
      id: 10,
      type: "roll",
      payload: {
        successes: 1,
        banes: 0,
      },
    },
  );

  assert.equal(nextState.events.length, 1);
  assert.equal(nextState.latestEventId, 10);
  assert.equal(nextState.sceneStrain, 0);
});

test("applySessionEvent updates scene strain from push and strain_reset payloads", () => {
  const pushed = applySessionEvent(
    createSessionState({
      sceneStrain: 2,
    }),
    {
      id: 11,
      type: "push",
      payload: {
        scene_strain: 5,
      },
    },
  );

  const reset = applySessionEvent(pushed, {
    id: 12,
    type: "strain_reset",
    payload: {},
  });

  assert.equal(pushed.sceneStrain, 5);
  assert.equal(reset.sceneStrain, 0);
});

test("applySessionEvent adds and updates players on join events", () => {
  const withJoin = applySessionEvent(
    createSessionState(),
    {
      id: 20,
      type: "join",
      payload: {
        token_id: 31,
        display_name: "Alice",
      },
      actor: {
        token_id: 31,
        display_name: "Alice",
        role: "player",
      },
    },
  );

  const withUpdate = applySessionEvent(withJoin, {
    id: 21,
    type: "join",
    payload: {
      token_id: 31,
      display_name: "Alice Prime",
    },
    actor: {
      token_id: 31,
      display_name: "Alice Prime",
      role: "player",
    },
  });

  assert.equal(withJoin.players.length, 1);
  assert.equal(withUpdate.players.length, 1);
  assert.equal(withUpdate.players[0].displayName, "Alice Prime");
});

test("applySessionEvent removes players on leave events", () => {
  const state = createSessionState({
    players: [
      {
        tokenId: 1,
        displayName: "GM",
        role: "gm",
      },
      {
        tokenId: 31,
        displayName: "Alice",
        role: "player",
      },
    ],
  });

  const nextState = applySessionEvent(state, {
    id: 30,
    type: "leave",
    payload: {
      token_id: 31,
      reason: "revoked",
    },
  });

  assert.deepEqual(nextState.players, [
    {
      tokenId: 1,
      displayName: "GM",
      role: "gm",
    },
  ]);
});

test("applySessionEvents preserves order and dedupes repeated ids", () => {
  const nextState = applySessionEvents(createSessionState(), [
    { id: 41, type: "roll", payload: { successes: 1, banes: 0 } },
    { id: 41, type: "roll", payload: { successes: 9, banes: 9 } },
    { id: 42, type: "push", payload: { scene_strain: 2 } },
  ]);

  assert.equal(nextState.events.length, 2);
  assert.equal(nextState.events[0].id, 41);
  assert.equal(nextState.events[1].id, 42);
  assert.equal(nextState.sceneStrain, 2);
  assert.equal(nextState.latestEventId, 42);
});

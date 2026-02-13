import assert from "node:assert/strict";
import test from "node:test";
import {
  canPushCurrentRoll,
  createRollSnapshot,
  isValidRollRequest,
  isValidResolution,
  transitionWithPush,
  transitionWithRoll,
} from "./roll-session.js";

test("createRollSnapshot returns normalized summary data", () => {
  const snapshot = createRollSnapshot(
    {
      dice: [
        { id: "a-1", type: "attribute", face: 6 },
        { id: "s-1", type: "skill", face: 2 },
      ],
    },
    { action: "roll", rolledAt: 42 },
  );

  assert.equal(snapshot.action, "roll");
  assert.equal(snapshot.rolledAt, 42);
  assert.deepEqual(snapshot.outcomes, {
    successes: 1,
    banes: 0,
    hasStrain: false,
  });
  assert.deepEqual(snapshot.pushableDiceIds, ["s-1"]);
  assert.equal(snapshot.canPush, true);
});

test("transitionWithRoll shifts current roll into previous roll", () => {
  const first = transitionWithRoll(
    {},
    {
      dice: [{ id: "a-1", type: "attribute", face: 2 }],
    },
    { rolledAt: 100 },
  );
  const second = transitionWithRoll(
    first,
    {
      dice: [{ id: "a-1", type: "attribute", face: 6 }],
    },
    { rolledAt: 101 },
  );

  assert.equal(first.previousRoll, null);
  assert.equal(first.currentRoll.rolledAt, 100);
  assert.equal(second.previousRoll.rolledAt, 100);
  assert.equal(second.currentRoll.rolledAt, 101);
  assert.equal(second.currentRoll.outcomes.successes, 1);
});

test("transitionWithPush updates session only when current roll can push", () => {
  const rolled = transitionWithRoll(
    {},
    {
      dice: [
        { id: "a-1", type: "attribute", face: 6 },
        { id: "s-1", type: "skill", face: 2 },
      ],
    },
    { rolledAt: 200 },
  );

  const pushed = transitionWithPush(
    rolled,
    {
      dice: [
        { id: "a-1", type: "attribute", face: 6 },
        { id: "s-1", type: "skill", face: 1 },
      ],
    },
    { rolledAt: 201 },
  );

  assert.equal(pushed.previousRoll.rolledAt, 200);
  assert.equal(pushed.currentRoll.action, "push");
  assert.equal(pushed.currentRoll.rolledAt, 201);
  assert.equal(pushed.currentRoll.outcomes.banes, 1);
});

test("transitionWithPush is a no-op when no pushable dice exist", () => {
  const rolled = transitionWithRoll(
    {},
    {
      dice: [
        { id: "a-1", type: "attribute", face: 6 },
        { id: "s-1", type: "skill", face: 1 },
      ],
    },
    { rolledAt: 300 },
  );

  const attemptedPush = transitionWithPush(
    rolled,
    {
      dice: [
        { id: "a-1", type: "attribute", face: 1 },
        { id: "s-1", type: "skill", face: 1 },
      ],
    },
    { rolledAt: 301 },
  );

  assert.deepEqual(attemptedPush, rolled);
  assert.equal(canPushCurrentRoll(rolled), false);
});

test("transition helpers are non-throwing for malformed payloads", () => {
  assert.doesNotThrow(() => transitionWithRoll(null, null));
  assert.doesNotThrow(() => transitionWithPush(null, null));
  assert.equal(createRollSnapshot(null), null);
});

test("isValidRollRequest accepts well-formed rollRequest objects", () => {
  const validRequest = {
    key: 42,
    action: "roll",
    dice: [{ id: "a-1", type: "attribute", face: null }],
    rerollIds: ["a-1"],
  };

  assert.equal(isValidRollRequest(validRequest), true);

  const validPush = {
    key: "push-key",
    action: "push",
    dice: [],
    rerollIds: [],
  };

  assert.equal(isValidRollRequest(validPush), true);
});

test("isValidRollRequest rejects malformed rollRequest objects", () => {
  assert.equal(isValidRollRequest(null), false);
  assert.equal(isValidRollRequest(undefined), false);
  assert.equal(isValidRollRequest("not an object"), false);
  assert.equal(isValidRollRequest({}), false); // missing required fields

  // Missing key
  assert.equal(
    isValidRollRequest({
      action: "roll",
      dice: [],
      rerollIds: [],
    }),
    false,
  );

  // Invalid action
  assert.equal(
    isValidRollRequest({
      key: 1,
      action: "invalid",
      dice: [],
      rerollIds: [],
    }),
    false,
  );

  // dice not an array
  assert.equal(
    isValidRollRequest({
      key: 1,
      action: "roll",
      dice: "not an array",
      rerollIds: [],
    }),
    false,
  );

  // rerollIds not an array
  assert.equal(
    isValidRollRequest({
      key: 1,
      action: "roll",
      dice: [],
      rerollIds: "not an array",
    }),
    false,
  );

  // rerollIds contains non-string values
  assert.equal(
    isValidRollRequest({
      key: 1,
      action: "roll",
      dice: [],
      rerollIds: [1, 2, 3],
    }),
    false,
  );
});

test("isValidResolution accepts well-formed resolution objects", () => {
  const validResolution = {
    key: 42,
    action: "roll",
    dice: [{ id: "a-1", type: "attribute", face: 6 }],
  };

  assert.equal(isValidResolution(validResolution), true);

  const validPushResolution = {
    key: "push-key",
    action: "push",
    dice: [],
  };

  assert.equal(isValidResolution(validPushResolution), true);
});

test("isValidResolution rejects malformed resolution objects", () => {
  assert.equal(isValidResolution(null), false);
  assert.equal(isValidResolution(undefined), false);
  assert.equal(isValidResolution("not an object"), false);
  assert.equal(isValidResolution({}), false); // missing required fields

  // Missing key
  assert.equal(
    isValidResolution({
      action: "roll",
      dice: [],
    }),
    false,
  );

  // Invalid action
  assert.equal(
    isValidResolution({
      key: 1,
      action: "invalid",
      dice: [],
    }),
    false,
  );

  // dice not an array
  assert.equal(
    isValidResolution({
      key: 1,
      action: "roll",
      dice: "not an array",
    }),
    false,
  );
});

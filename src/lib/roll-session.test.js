import assert from "node:assert/strict";
import test from "node:test";
import {
  canPushCurrentRoll,
  createRollSnapshot,
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

import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildSessionActionRequest,
  getCurrentRollActionId,
  MAX_SUBMITTED_SESSION_ACTIONS,
  normalizeActionErrorMessage,
  normalizeOutcomeCount,
} from "./session-action-helpers.js";

test("MAX_SUBMITTED_SESSION_ACTIONS stays capped at 100", () => {
  assert.equal(MAX_SUBMITTED_SESSION_ACTIONS, 100);
});

test("normalizeOutcomeCount accepts integer counts in range", () => {
  assert.equal(normalizeOutcomeCount(0), 0);
  assert.equal(normalizeOutcomeCount("99"), 99);
  assert.equal(normalizeOutcomeCount(100), null);
  assert.equal(normalizeOutcomeCount(-1), null);
  assert.equal(normalizeOutcomeCount(1.2), null);
});

test("buildSessionActionRequest normalizes roll payloads", () => {
  assert.deepEqual(
    buildSessionActionRequest({
      action: "roll",
      outcomes: {
        successes: 2,
        banes: 1,
      },
    }),
    {
      action: "roll",
      payload: {
        successes: 2,
        banes: 1,
      },
    },
  );

  assert.deepEqual(
    buildSessionActionRequest({
      action: "push",
      outcomes: {
        successes: 4,
        banes: 3,
        hasStrain: 1,
      },
    }),
    {
      action: "push",
      payload: {
        successes: 4,
        banes: 3,
        strain: true,
      },
    },
  );

  assert.equal(
    buildSessionActionRequest({
      action: "roll",
      outcomes: {
        successes: 101,
        banes: 0,
      },
    }),
    null,
  );
});

test("getCurrentRollActionId prefers recent result id with fallback", () => {
  assert.equal(
    getCurrentRollActionId(
      {
        action: "roll",
        rolledAt: 123,
      },
      [{ id: "  abc-123  " }],
    ),
    "abc-123",
  );

  assert.equal(
    getCurrentRollActionId(
      {
        action: "push",
        rolledAt: 456,
      },
      [{ id: "   " }],
    ),
    "push-456",
  );

  assert.equal(getCurrentRollActionId(null, []), null);
});

test("normalizeActionErrorMessage trims only string values", () => {
  assert.equal(normalizeActionErrorMessage("  error  "), "error");
  assert.equal(normalizeActionErrorMessage(42), "");
});

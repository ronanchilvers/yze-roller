import { describe, expect, test } from "vitest";
import {
  DEFAULT_DICE_RESULT_DURATION_MS,
  DEFAULT_TOAST_DURATION_MS,
  MAX_PENDING_TOASTS,
  TOAST_KIND,
  TOAST_KIND_VALUES,
  TOAST_TONE,
  TOAST_TONE_VALUES,
  isValidToastKind,
  isValidToastTone,
} from "./constants.js";

describe("toast constants", () => {
  test("defines the expected toast kinds", () => {
    expect(TOAST_KIND).toEqual({
      ALERT: "alert",
      DICE_RESULT: "diceResult",
      CONFIRM: "confirm",
    });
    expect(TOAST_KIND_VALUES).toEqual(["alert", "diceResult", "confirm"]);
  });

  test("defines the expected toast tones", () => {
    expect(TOAST_TONE).toEqual({
      INFO: "info",
      SUCCESS: "success",
      WARNING: "warning",
      DANGER: "danger",
    });
    expect(TOAST_TONE_VALUES).toEqual([
      "info",
      "success",
      "warning",
      "danger",
    ]);
  });

  test("defines default durations and queue size", () => {
    expect(DEFAULT_TOAST_DURATION_MS).toBe(5000);
    expect(DEFAULT_DICE_RESULT_DURATION_MS).toBe(10000);
    expect(MAX_PENDING_TOASTS).toBe(20);
  });

  test("validates kinds and tones", () => {
    expect(isValidToastKind("alert")).toBe(true);
    expect(isValidToastKind("unknown")).toBe(false);
    expect(isValidToastTone("warning")).toBe(true);
    expect(isValidToastTone("unknown")).toBe(false);
  });
});


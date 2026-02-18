export const TOAST_KIND = Object.freeze({
  ALERT: "alert",
  DICE_RESULT: "diceResult",
  CONFIRM: "confirm",
});

export const TOAST_TONE = Object.freeze({
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  DANGER: "danger",
});

export const DEFAULT_TOAST_DURATION_MS = 5000;
export const DEFAULT_DICE_RESULT_DURATION_MS = 10000;
export const MAX_PENDING_TOASTS = 20;

export const TOAST_KIND_VALUES = Object.freeze(Object.values(TOAST_KIND));
export const TOAST_TONE_VALUES = Object.freeze(Object.values(TOAST_TONE));

export const isValidToastKind = (value) => TOAST_KIND_VALUES.includes(value);
export const isValidToastTone = (value) => TOAST_TONE_VALUES.includes(value);


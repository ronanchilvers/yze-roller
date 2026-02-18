import { describe, expect, test, vi } from "vitest";
import {
  createToastId,
  enqueueTimedToast,
  normalizeToastDuration,
} from "./enqueue-timed-toast.js";

describe("normalizeToastDuration", () => {
  test("uses fallback duration when value is not finite", () => {
    expect(normalizeToastDuration(undefined, 5000)).toBe(5000);
    expect(normalizeToastDuration(NaN, 5000)).toBe(5000);
  });

  test("returns null for non-positive durations", () => {
    expect(normalizeToastDuration(0, 5000)).toBeNull();
    expect(normalizeToastDuration(-10, 5000)).toBeNull();
  });
});

describe("createToastId", () => {
  test("creates stable incrementing ids", () => {
    const idRef = { current: 0 };

    expect(createToastId(idRef)).toBe("toast-0");
    expect(createToastId(idRef)).toBe("toast-1");
    expect(idRef.current).toBe(2);
  });

  test("returns null for invalid refs", () => {
    expect(createToastId(null)).toBeNull();
  });
});

describe("enqueueTimedToast", () => {
  test("returns null when required callbacks are missing", () => {
    const result = enqueueTimedToast({
      defaultDurationMs: 5000,
      idRef: { current: 0 },
    });

    expect(result).toBeNull();
  });

  test("appends an entry and returns id", () => {
    let queue = [];
    const setToasts = (updater) => {
      queue = updater(queue);
    };

    const id = enqueueTimedToast({
      payload: { message: "Hello", duration: 3000 },
      defaultDurationMs: 5000,
      idRef: { current: 0 },
      setToasts,
      timersRef: { current: new Map() },
      removeToast: vi.fn(),
      createEntry: ({ id: nextId, payload, durationMs }) => ({
        id: nextId,
        kind: "alert",
        message: payload.message,
        duration: durationMs,
      }),
      scheduleTimeout: vi.fn(() => "timeout-id"),
    });

    expect(id).toBe("toast-0");
    expect(queue).toEqual([
      { id: "toast-0", kind: "alert", message: "Hello", duration: 3000 },
    ]);
  });

  test("registers timeout using fallback duration", () => {
    const timersRef = { current: new Map() };
    const removeToast = vi.fn();
    const scheduleTimeout = vi.fn((callback) => {
      callback();
      return "timeout-id";
    });

    enqueueTimedToast({
      payload: { message: "Hi" },
      defaultDurationMs: 5000,
      idRef: { current: 7 },
      setToasts: vi.fn((updater) => updater([])),
      timersRef,
      removeToast,
      createEntry: ({ id, durationMs }) => ({
        id,
        kind: "alert",
        duration: durationMs,
      }),
      scheduleTimeout,
    });

    expect(scheduleTimeout).toHaveBeenCalledTimes(1);
    expect(scheduleTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
    expect(removeToast).toHaveBeenCalledWith("toast-7");
    expect(timersRef.current.get("toast-7")).toBe("timeout-id");
  });

  test("does not schedule timeout when duration is non-positive", () => {
    const scheduleTimeout = vi.fn();
    const timersRef = { current: new Map() };

    enqueueTimedToast({
      payload: { message: "Pinned", duration: 0 },
      defaultDurationMs: 5000,
      idRef: { current: 2 },
      setToasts: vi.fn((updater) => updater([])),
      timersRef,
      removeToast: vi.fn(),
      createEntry: ({ id, durationMs }) => ({
        id,
        kind: "alert",
        duration: durationMs,
      }),
      scheduleTimeout,
    });

    expect(scheduleTimeout).not.toHaveBeenCalled();
    expect(timersRef.current.size).toBe(0);
  });

  test("returns null when createEntry rejects payload", () => {
    const setToasts = vi.fn();
    const scheduleTimeout = vi.fn();

    const id = enqueueTimedToast({
      payload: { message: "" },
      defaultDurationMs: 5000,
      idRef: { current: 0 },
      setToasts,
      timersRef: { current: new Map() },
      removeToast: vi.fn(),
      createEntry: () => null,
      scheduleTimeout,
    });

    expect(id).toBeNull();
    expect(setToasts).not.toHaveBeenCalled();
    expect(scheduleTimeout).not.toHaveBeenCalled();
  });
});


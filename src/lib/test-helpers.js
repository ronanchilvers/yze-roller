/**
 * Shared test utilities for deterministic dice testing.
 *
 * @module test-helpers
 */

/**
 * Creates a deterministic RNG that returns values from the given samples
 * array in sequence. After exhausting all samples, it continues returning
 * the last sample value.
 *
 * @param {number[]} samples - Array of values (0–1) to return in order
 * @returns {() => number} A function compatible with Math.random signature
 */
export const createSequenceRng = (samples) => {
  let index = 0;

  return () => {
    const sample = samples[index];
    index = Math.min(index + 1, samples.length);
    return sample;
  };
};
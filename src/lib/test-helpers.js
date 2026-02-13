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
 * **Note:** This function is used to override the default cryptoRandom source
 * in dice.js for deterministic testing. Production code uses crypto.getRandomValues
 * via cryptoRandom() for fairness-critical dice outcomes.
 *
 * @param {number[]} samples - Array of values (0–1) to return in order
 * @returns {() => number} A function compatible with the randomSource signature
 */
export const createSequenceRng = (samples) => {
  let index = 0;

  return () => {
    const sample = samples[index];
    index = Math.min(index + 1, samples.length);
    return sample;
  };
};

/**
 * Cryptographically secure random number generation for dice rolling.
 * 
 * This module provides a drop-in replacement for Math.random() that uses
 * crypto.getRandomValues() to ensure fairness in dice outcomes.
 * 
 * ## Usage contexts
 * 
 * **Fairness-critical (dice outcomes):**
 * - `rollD6()` in dice.js — determines die face values
 * - `rollDice()` and `pushDice()` — batch roll operations
 * - `rollPool()` and `pushPool()` — high-level roll APIs
 * 
 * **Cosmetic (visual randomness only):**
 * - `randomBetween()` in physics.js — spawn positions, velocities, angular momentum
 * - `createFeltTexture()` in textures.js — visual noise in felt texture grain
 * 
 * The distinction matters: cosmetic randomness affects appearance and feel,
 * but does not influence game outcomes. Using secure random for both provides
 * defense-in-depth and eliminates a potential attack surface.
 */

/**
 * Generates a cryptographically secure random float in the range [0, 1).
 * 
 * Uses crypto.getRandomValues with a 32-bit unsigned integer to provide
 * a uniform distribution equivalent to Math.random() but with cryptographic
 * guarantees. This ensures dice rolls cannot be predicted or manipulated
 * through timing attacks or PRNG weaknesses.
 * 
 * @returns {number} A random float in the range [0, 1), uniformly distributed
 * @throws {Error} If crypto.getRandomValues is unavailable (SSR contexts, very old browsers)
 * 
 * @example
 * const roll = Math.floor(cryptoRandom() * 6) + 1; // Fair d6 roll (1-6)
 */
export const cryptoRandom = () => {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error(
      "crypto.getRandomValues is not available. " +
      "This environment does not support secure random number generation."
    );
  }

  // Create a single 32-bit unsigned integer
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);

  // Normalize to [0, 1) by dividing by 2^32
  // The 0x100000000 constant is 2^32 (4294967296)
  return buffer[0] / 0x100000000;
};
import * as CANNON from "cannon-es";
import { cryptoRandom } from "./secure-random.js";

// Physics constants
export const DIE_SIZE = 0.68;

// Bounce damping factor when dice hit walls
const WALL_BOUNCE_DAMPING = -0.35;

// Spawn position constraints (fraction of viewport bounds)
const SPAWN_POSITION_FACTOR = 0.44;

// Push reroll position offsets
const PUSH_HORIZONTAL_JITTER = 0.32;
const PUSH_MIN_HEIGHT = 3.2;
const PUSH_VERTICAL_LIFT = 1.8;

// Initial roll spawn heights
const ROLL_MIN_SPAWN_HEIGHT = 9.2;
const ROLL_MAX_SPAWN_HEIGHT = 13.8;

// Spawn velocity ranges
const HORIZONTAL_VELOCITY_RANGE = 6.4;
const MIN_VERTICAL_VELOCITY = 4.2;
const MAX_VERTICAL_VELOCITY = 7.9;
const ANGULAR_VELOCITY_RANGE = 26;

// Push reroll spread factors (fraction of viewport bounds)
const PUSH_SPREAD_FACTOR = 0.32;
const ROLL_SPREAD_FACTOR = 0.58;

// Edge nudge impulse strength
const EDGE_NUDGE_STRENGTH = 0.018;
const EDGE_NUDGE_MIN_VERTICAL = 0.004;
const EDGE_NUDGE_MAX_VERTICAL = 0.016;
const EDGE_NUDGE_ANGULAR_RANGE_XZ = 0.35;
const EDGE_NUDGE_ANGULAR_RANGE_Y = 0.2;

/**
 * Generates a random float between min and max (inclusive).
 *
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {() => number} [randomSource=cryptoRandom] - Random number generator (cosmetic use)
 * @returns {number} Random value in range [min, max]
 */
export const randomBetween = (min, max, randomSource = cryptoRandom) => {
  return min + randomSource() * (max - min);
};

/**
 * Creates a static physics body (immovable wall or floor).
 *
 * @param {CANNON.Vec3} halfExtents - Half-dimensions of the box
 * @param {{ x: number, y: number, z: number }} position - World position
 * @returns {CANNON.Body} Static physics body
 */
export const createStaticBox = (halfExtents, position) => {
  const body = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(halfExtents),
  });
  body.position.set(position.x, position.y, position.z);
  return body;
};

/**
 * Freezes a physics body in place (makes it kinematic and stops all motion).
 * Used to lock dice in their final position after settling.
 *
 * @param {CANNON.Body} body - The physics body to freeze
 */
export const freezeBodyInPlace = (body) => {
  body.type = CANNON.Body.KINEMATIC;
  body.mass = 0;
  body.updateMassProperties();
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.sleep();
};

/**
 * Constrains a physics body within viewport bounds with optional bounce.
 * Prevents dice from flying off-screen or falling through the floor.
 *
 * @param {CANNON.Body} body - The physics body to constrain
 * @param {{ innerHalfWidth: number, innerHalfDepth: number }} bounds - Viewport bounds
 * @param {boolean} [allowBounce=true] - Whether to apply bounce physics at walls
 */
export const clampBodyInside = (body, bounds, allowBounce = true) => {
  const xLimit = Math.max(0.8, bounds.innerHalfWidth - DIE_SIZE * 0.5);
  const zLimit = Math.max(0.8, bounds.innerHalfDepth - DIE_SIZE * 0.5);
  const minY = DIE_SIZE * 0.5;

  if (body.position.x > xLimit) {
    body.position.x = xLimit;

    if (allowBounce && body.velocity.x > 0) {
      body.velocity.x *= WALL_BOUNCE_DAMPING;
    }
  }

  if (body.position.x < -xLimit) {
    body.position.x = -xLimit;

    if (allowBounce && body.velocity.x < 0) {
      body.velocity.x *= WALL_BOUNCE_DAMPING;
    }
  }

  if (body.position.z > zLimit) {
    body.position.z = zLimit;

    if (allowBounce && body.velocity.z > 0) {
      body.velocity.z *= WALL_BOUNCE_DAMPING;
    }
  }

  if (body.position.z < -zLimit) {
    body.position.z = -zLimit;

    if (allowBounce && body.velocity.z < 0) {
      body.velocity.z *= WALL_BOUNCE_DAMPING;
    }
  }

  if (!allowBounce && body.position.y < minY) {
    body.position.y = minY;

    if (body.velocity.y < 0) {
      body.velocity.y = 0;
    }
  }
};

/**
 * Positions a physics body at a random spawn point within viewport bounds.
 * Used for initial die placement before rolling.
 *
 * @param {CANNON.Body} body - The physics body to position
 * @param {{ innerHalfWidth: number, innerHalfDepth: number }} bounds - Viewport bounds
 */
export const spawnBodyInViewport = (body, bounds) => {
  body.position.set(
    randomBetween(
      -bounds.innerHalfWidth * SPAWN_POSITION_FACTOR,
      bounds.innerHalfWidth * SPAWN_POSITION_FACTOR,
    ),
    DIE_SIZE * 0.5,
    randomBetween(
      -bounds.innerHalfDepth * SPAWN_POSITION_FACTOR,
      bounds.innerHalfDepth * SPAWN_POSITION_FACTOR,
    ),
  );
};

/**
 * Launches a die with physics for rolling or pushing.
 * Sets position, velocity, and angular velocity for realistic tumbling motion.
 *
 * @param {CANNON.Body} body - The die body to launch
 * @param {{ innerHalfWidth: number, innerHalfDepth: number }} bounds - Viewport bounds
 * @param {boolean} isPushReroll - Whether this is a push (true) or initial roll (false)
 */
export const launchRollingBody = (body, bounds, isPushReroll) => {
  body.type = CANNON.Body.DYNAMIC;
  body.mass = 1;
  body.updateMassProperties();

  const xSpread =
    bounds.innerHalfWidth *
    (isPushReroll ? PUSH_SPREAD_FACTOR : ROLL_SPREAD_FACTOR);
  const zSpread =
    bounds.innerHalfDepth *
    (isPushReroll ? PUSH_SPREAD_FACTOR : ROLL_SPREAD_FACTOR);

  if (isPushReroll) {
    // Push: lift die from current position with small horizontal jitter
    body.position.set(
      body.position.x +
        randomBetween(-PUSH_HORIZONTAL_JITTER, PUSH_HORIZONTAL_JITTER),
      Math.max(body.position.y + PUSH_VERTICAL_LIFT, PUSH_MIN_HEIGHT),
      body.position.z +
        randomBetween(-PUSH_HORIZONTAL_JITTER, PUSH_HORIZONTAL_JITTER),
    );
  } else {
    // Roll: spawn dice from high above with wide spread
    body.position.set(
      randomBetween(-xSpread, xSpread),
      randomBetween(ROLL_MIN_SPAWN_HEIGHT, ROLL_MAX_SPAWN_HEIGHT),
      randomBetween(-zSpread, zSpread),
    );
  }

  body.velocity.set(
    randomBetween(-HORIZONTAL_VELOCITY_RANGE, HORIZONTAL_VELOCITY_RANGE),
    randomBetween(MIN_VERTICAL_VELOCITY, MAX_VERTICAL_VELOCITY),
    randomBetween(-HORIZONTAL_VELOCITY_RANGE, HORIZONTAL_VELOCITY_RANGE),
  );
  body.angularVelocity.set(
    randomBetween(-ANGULAR_VELOCITY_RANGE, ANGULAR_VELOCITY_RANGE),
    randomBetween(-ANGULAR_VELOCITY_RANGE, ANGULAR_VELOCITY_RANGE),
    randomBetween(-ANGULAR_VELOCITY_RANGE, ANGULAR_VELOCITY_RANGE),
  );

  body.wakeUp();
};

/**
 * Applies a small impulse to nudge a die that has settled on an edge.
 * Helps dice naturally fall to a stable face orientation.
 *
 * @param {CANNON.Body} body - The die body to nudge
 */
export const nudgeEdgeLeaningDie = (body) => {
  const impulse = new CANNON.Vec3(
    randomBetween(-EDGE_NUDGE_STRENGTH, EDGE_NUDGE_STRENGTH),
    randomBetween(EDGE_NUDGE_MIN_VERTICAL, EDGE_NUDGE_MAX_VERTICAL),
    randomBetween(-EDGE_NUDGE_STRENGTH, EDGE_NUDGE_STRENGTH),
  );

  body.applyImpulse(impulse, body.position);
  body.angularVelocity.set(
    body.angularVelocity.x +
      randomBetween(-EDGE_NUDGE_ANGULAR_RANGE_XZ, EDGE_NUDGE_ANGULAR_RANGE_XZ),
    body.angularVelocity.y +
      randomBetween(-EDGE_NUDGE_ANGULAR_RANGE_Y, EDGE_NUDGE_ANGULAR_RANGE_Y),
    body.angularVelocity.z +
      randomBetween(-EDGE_NUDGE_ANGULAR_RANGE_XZ, EDGE_NUDGE_ANGULAR_RANGE_XZ),
  );
  body.wakeUp();
};

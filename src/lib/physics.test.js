import assert from "node:assert/strict";
import { test } from "vitest";
import { Body, Box, Vec3 } from "cannon-es";
import {
  DIE_SIZE,
  clampBodyInside,
  createStaticBox,
  freezeBodyInPlace,
  randomBetween,
} from "./physics.js";

const createMockBounds = (halfWidth = 4.0, halfDepth = 3.0) => ({
  innerHalfWidth: halfWidth,
  innerHalfDepth: halfDepth,
});

const createDynamicBody = (x = 0, y = 0.5, z = 0) => {
  const body = new Body({
    mass: 1,
    shape: new Box(new Vec3(DIE_SIZE / 2, DIE_SIZE / 2, DIE_SIZE / 2)),
  });
  body.position.set(x, y, z);
  return body;
};

test("clampBodyInside does nothing when body is within bounds", () => {
  const body = createDynamicBody(1, 0.5, 1);
  const bounds = createMockBounds();
  body.velocity.set(2, 0, 2);

  clampBodyInside(body, bounds, true);

  assert.equal(body.position.x, 1);
  assert.equal(body.position.z, 1);
  assert.equal(body.velocity.x, 2);
  assert.equal(body.velocity.z, 2);
});

test("clampBodyInside clamps positive X overflow with bounce", () => {
  const bounds = createMockBounds(4.0, 3.0);
  const xLimit = Math.max(0.8, bounds.innerHalfWidth - DIE_SIZE * 0.5);
  const body = createDynamicBody(xLimit + 2, 0.5, 0);
  body.velocity.set(5, 0, 0);

  clampBodyInside(body, bounds, true);

  assert.equal(body.position.x, xLimit);
  assert.ok(body.velocity.x < 0, "Velocity should be reversed (bounced)");
});

test("clampBodyInside clamps negative X overflow with bounce", () => {
  const bounds = createMockBounds(4.0, 3.0);
  const xLimit = Math.max(0.8, bounds.innerHalfWidth - DIE_SIZE * 0.5);
  const body = createDynamicBody(-xLimit - 2, 0.5, 0);
  body.velocity.set(-5, 0, 0);

  clampBodyInside(body, bounds, true);

  assert.equal(body.position.x, -xLimit);
  assert.ok(body.velocity.x > 0, "Velocity should be reversed (bounced)");
});

test("clampBodyInside clamps positive Z overflow with bounce", () => {
  const bounds = createMockBounds(4.0, 3.0);
  const zLimit = Math.max(0.8, bounds.innerHalfDepth - DIE_SIZE * 0.5);
  const body = createDynamicBody(0, 0.5, zLimit + 2);
  body.velocity.set(0, 0, 5);

  clampBodyInside(body, bounds, true);

  assert.equal(body.position.z, zLimit);
  assert.ok(body.velocity.z < 0, "Z velocity should be reversed (bounced)");
});

test("clampBodyInside clamps negative Z overflow with bounce", () => {
  const bounds = createMockBounds(4.0, 3.0);
  const zLimit = Math.max(0.8, bounds.innerHalfDepth - DIE_SIZE * 0.5);
  const body = createDynamicBody(0, 0.5, -zLimit - 2);
  body.velocity.set(0, 0, -5);

  clampBodyInside(body, bounds, true);

  assert.equal(body.position.z, -zLimit);
  assert.ok(body.velocity.z > 0, "Z velocity should be reversed (bounced)");
});

test("clampBodyInside does not bounce when allowBounce is false", () => {
  const bounds = createMockBounds(4.0, 3.0);
  const xLimit = Math.max(0.8, bounds.innerHalfWidth - DIE_SIZE * 0.5);
  const body = createDynamicBody(xLimit + 2, 0.5, 0);
  body.velocity.set(5, 0, 0);

  clampBodyInside(body, bounds, false);

  assert.equal(body.position.x, xLimit);
  assert.equal(
    body.velocity.x,
    5,
    "Velocity should be unchanged when bounce is disabled",
  );
});

test("clampBodyInside clamps Y position when allowBounce is false", () => {
  const bounds = createMockBounds();
  const minY = DIE_SIZE * 0.5;
  const body = createDynamicBody(0, -1, 0);
  body.velocity.set(0, -3, 0);

  clampBodyInside(body, bounds, false);

  assert.equal(body.position.y, minY);
  assert.equal(body.velocity.y, 0, "Downward Y velocity should be zeroed");
});

test("clampBodyInside preserves upward Y velocity when below floor without bounce", () => {
  const bounds = createMockBounds();
  const body = createDynamicBody(0, -1, 0);
  body.velocity.set(0, 5, 0);

  clampBodyInside(body, bounds, false);

  assert.equal(body.position.y, DIE_SIZE * 0.5);
  assert.equal(body.velocity.y, 5, "Upward velocity should be preserved");
});

test("clampBodyInside handles simultaneous X and Z overflow", () => {
  const bounds = createMockBounds(4.0, 3.0);
  const xLimit = Math.max(0.8, bounds.innerHalfWidth - DIE_SIZE * 0.5);
  const zLimit = Math.max(0.8, bounds.innerHalfDepth - DIE_SIZE * 0.5);
  const body = createDynamicBody(xLimit + 5, 0.5, zLimit + 5);
  body.velocity.set(10, 0, 10);

  clampBodyInside(body, bounds, true);

  assert.equal(body.position.x, xLimit);
  assert.equal(body.position.z, zLimit);
  assert.ok(body.velocity.x < 0, "X velocity should bounce");
  assert.ok(body.velocity.z < 0, "Z velocity should bounce");
});

test("clampBodyInside does not reverse velocity moving away from wall", () => {
  const bounds = createMockBounds(4.0, 3.0);
  const xLimit = Math.max(0.8, bounds.innerHalfWidth - DIE_SIZE * 0.5);
  const body = createDynamicBody(xLimit + 1, 0.5, 0);
  // Velocity is already pointing inward (negative)
  body.velocity.set(-3, 0, 0);

  clampBodyInside(body, bounds, true);

  assert.equal(body.position.x, xLimit);
  assert.equal(body.velocity.x, -3, "Inward velocity should not be reversed");
});

test("clampBodyInside uses minimum limit of 0.8 for very small bounds", () => {
  const tinyBounds = createMockBounds(0.5, 0.5);
  const body = createDynamicBody(2, 0.5, 2);

  clampBodyInside(body, tinyBounds, false);

  assert.equal(
    body.position.x,
    0.8,
    "Should clamp to minimum 0.8 when bounds are tiny",
  );
  assert.equal(
    body.position.z,
    0.8,
    "Should clamp to minimum 0.8 when bounds are tiny",
  );
});

test("createStaticBox returns a static body at the given position", () => {
  const halfExtents = new Vec3(2, 1, 3);
  const position = { x: 1, y: 2, z: 3 };
  const body = createStaticBox(halfExtents, position);

  assert.equal(body.type, Body.STATIC);
  assert.equal(body.mass, 0);
  assert.equal(body.position.x, 1);
  assert.equal(body.position.y, 2);
  assert.equal(body.position.z, 3);
});

test("createStaticBox body has a box shape", () => {
  const halfExtents = new Vec3(2, 1, 3);
  const body = createStaticBox(halfExtents, { x: 0, y: 0, z: 0 });

  assert.equal(body.shapes.length, 1);
  assert.ok(body.shapes[0] instanceof Box, "Shape should be a Box");
});

test("freezeBodyInPlace stops all motion and makes body kinematic", () => {
  const body = createDynamicBody(1, 2, 3);
  body.velocity.set(10, 20, 30);
  body.angularVelocity.set(5, 5, 5);

  freezeBodyInPlace(body);

  assert.equal(body.type, Body.KINEMATIC);
  assert.equal(body.mass, 0);
  assert.equal(body.velocity.x, 0);
  assert.equal(body.velocity.y, 0);
  assert.equal(body.velocity.z, 0);
  assert.equal(body.angularVelocity.x, 0);
  assert.equal(body.angularVelocity.y, 0);
  assert.equal(body.angularVelocity.z, 0);
});

test("freezeBodyInPlace preserves body position", () => {
  const body = createDynamicBody(3, 5, 7);
  body.velocity.set(10, 20, 30);

  freezeBodyInPlace(body);

  assert.equal(body.position.x, 3);
  assert.equal(body.position.y, 5);
  assert.equal(body.position.z, 7);
});

test("randomBetween returns a value within the given range", () => {
  for (let i = 0; i < 50; i += 1) {
    const result = randomBetween(2, 8);
    assert.ok(result >= 2, `Result ${result} should be >= 2`);
    assert.ok(result <= 8, `Result ${result} should be <= 8`);
  }
});

test("randomBetween returns exact value when min equals max", () => {
  const result = randomBetween(5, 5);
  assert.equal(result, 5);
});

test("DIE_SIZE is a positive number", () => {
  assert.ok(DIE_SIZE > 0, "DIE_SIZE should be positive");
  assert.equal(typeof DIE_SIZE, "number");
});

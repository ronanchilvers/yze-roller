import assert from "node:assert/strict";
import test from "node:test";
import { calculateBounds } from "./viewport-bounds.js";

const createOrthographicCamera = (left, right, top, bottom, zoom = 1) => ({
  isOrthographicCamera: true,
  left,
  right,
  top,
  bottom,
  zoom,
  position: { y: 16 },
});

const createPerspectiveCamera = (fov, positionY = 16) => ({
  isPerspectiveCamera: true,
  fov,
  position: { y: positionY },
});

const createSize = (width = 800, height = 600) => ({ width, height });

test("calculateBounds returns an object with expected shape", () => {
  const bounds = calculateBounds(null, createSize());

  assert.equal(typeof bounds.visibleHalfWidth, "number");
  assert.equal(typeof bounds.visibleHalfDepth, "number");
  assert.equal(typeof bounds.innerHalfWidth, "number");
  assert.equal(typeof bounds.innerHalfDepth, "number");
});

test("calculateBounds returns fallback values when camera is null", () => {
  const bounds = calculateBounds(null, createSize());

  assert.equal(bounds.visibleHalfWidth, 4.6);
  assert.equal(bounds.visibleHalfDepth, 3.1);
  assert.ok(bounds.innerHalfWidth > 0, "innerHalfWidth should be positive");
  assert.ok(bounds.innerHalfDepth > 0, "innerHalfDepth should be positive");
});

test("calculateBounds returns fallback values when camera is undefined", () => {
  const bounds = calculateBounds(undefined, createSize());

  assert.equal(bounds.visibleHalfWidth, 4.6);
  assert.equal(bounds.visibleHalfDepth, 3.1);
});

test("calculateBounds handles orthographic camera", () => {
  const camera = createOrthographicCamera(-10, 10, 8, -8, 1);
  const bounds = calculateBounds(camera, createSize());

  assert.equal(bounds.visibleHalfWidth, 10);
  assert.equal(bounds.visibleHalfDepth, 8);
  assert.ok(
    bounds.innerHalfWidth < bounds.visibleHalfWidth,
    "Inner width should be smaller than visible",
  );
  assert.ok(
    bounds.innerHalfDepth < bounds.visibleHalfDepth,
    "Inner depth should be smaller than visible",
  );
});

test("calculateBounds orthographic camera respects zoom", () => {
  const camera1x = createOrthographicCamera(-10, 10, 8, -8, 1);
  const camera2x = createOrthographicCamera(-10, 10, 8, -8, 2);
  const size = createSize();

  const bounds1x = calculateBounds(camera1x, size);
  const bounds2x = calculateBounds(camera2x, size);

  assert.ok(
    bounds2x.visibleHalfWidth < bounds1x.visibleHalfWidth,
    "Higher zoom should reduce visible half width",
  );
  assert.ok(
    bounds2x.visibleHalfDepth < bounds1x.visibleHalfDepth,
    "Higher zoom should reduce visible half depth",
  );
});

test("calculateBounds orthographic camera falls back to zoom 1 for invalid zoom", () => {
  const cameraZero = createOrthographicCamera(-10, 10, 8, -8, 0);
  const cameraNeg = createOrthographicCamera(-10, 10, 8, -8, -1);
  const cameraNaN = createOrthographicCamera(-10, 10, 8, -8, NaN);
  const cameraValid = createOrthographicCamera(-10, 10, 8, -8, 1);
  const size = createSize();

  const boundsZero = calculateBounds(cameraZero, size);
  const boundsNeg = calculateBounds(cameraNeg, size);
  const boundsNaN = calculateBounds(cameraNaN, size);
  const boundsValid = calculateBounds(cameraValid, size);

  assert.equal(boundsZero.visibleHalfWidth, boundsValid.visibleHalfWidth);
  assert.equal(boundsNeg.visibleHalfWidth, boundsValid.visibleHalfWidth);
  assert.equal(boundsNaN.visibleHalfWidth, boundsValid.visibleHalfWidth);
});

test("calculateBounds handles perspective camera", () => {
  const camera = createPerspectiveCamera(50, 16);
  const size = createSize(1200, 800);
  const bounds = calculateBounds(camera, size);

  assert.ok(
    bounds.visibleHalfWidth > 0,
    "Visible half width should be positive",
  );
  assert.ok(
    bounds.visibleHalfDepth > 0,
    "Visible half depth should be positive",
  );
  assert.ok(bounds.innerHalfWidth > 0, "Inner half width should be positive");
  assert.ok(bounds.innerHalfDepth > 0, "Inner half depth should be positive");
});

test("calculateBounds perspective camera scales with aspect ratio", () => {
  const camera = createPerspectiveCamera(50, 16);
  const wide = createSize(1600, 800);
  const narrow = createSize(800, 800);

  const boundsWide = calculateBounds(camera, wide);
  const boundsNarrow = calculateBounds(camera, narrow);

  assert.ok(
    boundsWide.visibleHalfWidth > boundsNarrow.visibleHalfWidth,
    "Wider viewport should produce larger half width",
  );
});

test("calculateBounds perspective camera uses fallback when size.height is 0", () => {
  const camera = createPerspectiveCamera(50, 16);
  const zeroSize = createSize(800, 0);
  const bounds = calculateBounds(camera, zeroSize);

  // Should fall through to default values since size.height is falsy
  assert.equal(bounds.visibleHalfWidth, 4.6);
  assert.equal(bounds.visibleHalfDepth, 3.1);
});

test("calculateBounds perspective camera scales with distance", () => {
  const cameraClose = createPerspectiveCamera(50, 8);
  const cameraFar = createPerspectiveCamera(50, 32);
  const size = createSize(800, 600);

  const boundsClose = calculateBounds(cameraClose, size);
  const boundsFar = calculateBounds(cameraFar, size);

  assert.ok(
    boundsFar.visibleHalfWidth > boundsClose.visibleHalfWidth,
    "Greater camera distance should produce larger visible area",
  );
});

test("calculateBounds enforces minimum visible dimensions", () => {
  // Tiny orthographic camera with very small frustum
  const camera = createOrthographicCamera(-0.5, 0.5, 0.5, -0.5, 1);
  const bounds = calculateBounds(camera, createSize());

  assert.ok(
    bounds.visibleHalfWidth >= 2.8,
    `visibleHalfWidth ${bounds.visibleHalfWidth} should be >= 2.8`,
  );
  assert.ok(
    bounds.visibleHalfDepth >= 2.2,
    `visibleHalfDepth ${bounds.visibleHalfDepth} should be >= 2.2`,
  );
});

test("calculateBounds enforces minimum inner dimensions", () => {
  const camera = createOrthographicCamera(-0.5, 0.5, 0.5, -0.5, 1);
  const bounds = calculateBounds(camera, createSize());

  assert.ok(
    bounds.innerHalfWidth >= 1.4,
    `innerHalfWidth ${bounds.innerHalfWidth} should be >= 1.4`,
  );
  assert.ok(
    bounds.innerHalfDepth >= 1.2,
    `innerHalfDepth ${bounds.innerHalfDepth} should be >= 1.2`,
  );
});

test("calculateBounds inner dimensions are smaller than visible dimensions", () => {
  const camera = createOrthographicCamera(-10, 10, 8, -8, 1);
  const bounds = calculateBounds(camera, createSize());

  assert.ok(
    bounds.innerHalfWidth < bounds.visibleHalfWidth,
    "Inner half width should account for wall thickness and die margin",
  );
  assert.ok(
    bounds.innerHalfDepth < bounds.visibleHalfDepth,
    "Inner half depth should account for wall thickness and die margin",
  );
});

test("calculateBounds returns consistent results for same input", () => {
  const camera = createOrthographicCamera(-10, 10, 8, -8, 2);
  const size = createSize(1024, 768);

  const bounds1 = calculateBounds(camera, size);
  const bounds2 = calculateBounds(camera, size);

  assert.deepEqual(
    bounds1,
    bounds2,
    "Same input should produce identical output",
  );
});

test("calculateBounds ignores unrecognized camera types gracefully", () => {
  const weirdCamera = { isSomeOtherCamera: true, position: { y: 10 } };
  const bounds = calculateBounds(weirdCamera, createSize());

  // Should use fallback values
  assert.equal(bounds.visibleHalfWidth, 4.6);
  assert.equal(bounds.visibleHalfDepth, 3.1);
});

import * as THREE from "three";

// Die physical size
const DIE_SIZE = 0.68;

// Wall and floor dimensions
const WALL_THICKNESS = 0.24;

// Minimum safe bounds (fallback values)
const MIN_HALF_WIDTH = 2.8;
const MIN_HALF_DEPTH = 2.2;

// Absolute minimum inner bounds
const ABSOLUTE_MIN_INNER_HALF_WIDTH = 1.4;
const ABSOLUTE_MIN_INNER_HALF_DEPTH = 1.2;

/**
 * Calculates the visible viewport bounds and inner play area for dice physics.
 * Accounts for orthographic vs perspective cameras and ensures minimum safe dimensions.
 *
 * @param {THREE.Camera} camera - The Three.js camera (orthographic or perspective)
 * @param {{ width: number, height: number }} size - Viewport pixel dimensions
 * @returns {{
 *   visibleHalfWidth: number,
 *   visibleHalfDepth: number,
 *   innerHalfWidth: number,
 *   innerHalfDepth: number
 * }} Calculated bounds for rendering and physics
 */
export const calculateBounds = (camera, size) => {
  let visibleHalfWidth = 4.6;
  let visibleHalfDepth = 3.1;

  if (camera?.isOrthographicCamera) {
    const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
    visibleHalfWidth = Math.max(MIN_HALF_WIDTH, (camera.right - camera.left) / (2 * zoom));
    visibleHalfDepth = Math.max(MIN_HALF_DEPTH, (camera.top - camera.bottom) / (2 * zoom));
  } else if (camera?.isPerspectiveCamera && size.height) {
    const distance = Math.abs(camera.position.y);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const visibleDepth = 2 * Math.tan(verticalFov * 0.5) * distance;
    const visibleWidth = visibleDepth * (size.width / size.height);
    visibleHalfWidth = Math.max(MIN_HALF_WIDTH, visibleWidth * 0.48);
    visibleHalfDepth = Math.max(MIN_HALF_DEPTH, visibleDepth * 0.48);
  }

  const innerMargin = DIE_SIZE * 0.74 + WALL_THICKNESS;

  return {
    visibleHalfWidth,
    visibleHalfDepth,
    innerHalfWidth: Math.max(ABSOLUTE_MIN_INNER_HALF_WIDTH, visibleHalfWidth - innerMargin),
    innerHalfDepth: Math.max(ABSOLUTE_MIN_INNER_HALF_DEPTH, visibleHalfDepth - innerMargin),
  };
};
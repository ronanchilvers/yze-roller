import * as THREE from "three";
import * as CANNON from "cannon-es";

/**
 * Maps die face normals to their numeric values (1-6).
 * Each face normal points outward from the die center when that face is "up".
 */
export const FACE_NORMALS = [
  { value: 1, normal: new THREE.Vector3(0, 1, 0) },
  { value: 2, normal: new THREE.Vector3(1, 0, 0) },
  { value: 3, normal: new THREE.Vector3(0, 0, 1) },
  { value: 4, normal: new THREE.Vector3(0, 0, -1) },
  { value: 5, normal: new THREE.Vector3(-1, 0, 0) },
  { value: 6, normal: new THREE.Vector3(0, -1, 0) },
];

/**
 * World "up" direction (positive Y axis).
 */
const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Determines which die face is pointing upward based on the die's rotation.
 * Returns both the face value and how well-aligned it is (1.0 = perfectly aligned).
 *
 * @param {CANNON.Quaternion} quaternion - The die body's rotation quaternion
 * @returns {{ faceValue: number, alignment: number }} The top face (1-6) and alignment score
 */
export const topFaceFromQuaternion = (quaternion) => {
  const threeQuat = new THREE.Quaternion(
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w,
  );

  let bestFace = 1;
  let bestDot = -Infinity;

  for (const candidate of FACE_NORMALS) {
    const worldNormal = candidate.normal.clone().applyQuaternion(threeQuat);
    const dot = worldNormal.dot(WORLD_UP);

    if (dot > bestDot) {
      bestDot = dot;
      bestFace = candidate.value;
    }
  }

  return { faceValue: bestFace, alignment: bestDot };
};

/**
 * Creates a quaternion that orients a die so the specified face is pointing up.
 * Used for initial die placement before rolling.
 *
 * @param {number} faceValue - The desired face value (1-6) to point upward
 * @returns {CANNON.Quaternion} Quaternion that orients the die correctly
 */
export const quaternionForFaceValue = (faceValue) => {
  const faceNormal =
    FACE_NORMALS.find((face) => face.value === faceValue)?.normal ??
    FACE_NORMALS[0].normal;
  const baseQuaternion = new THREE.Quaternion().setFromUnitVectors(
    faceNormal,
    WORLD_UP,
  );

  return new CANNON.Quaternion(
    baseQuaternion.x,
    baseQuaternion.y,
    baseQuaternion.z,
    baseQuaternion.w,
  );
};

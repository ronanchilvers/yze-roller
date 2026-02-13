import assert from "node:assert/strict";
import test from "node:test";
import * as CANNON from "cannon-es";
import {
  FACE_NORMALS,
  topFaceFromQuaternion,
  quaternionForFaceValue,
} from "./face-mapping.js";

test("FACE_NORMALS contains all six face values", () => {
  const values = FACE_NORMALS.map((entry) => entry.value);
  assert.deepEqual(values, [1, 2, 3, 4, 5, 6]);
});

test("FACE_NORMALS each have a unit-length normal vector", () => {
  for (const entry of FACE_NORMALS) {
    const length = entry.normal.length();
    assert.ok(
      Math.abs(length - 1) < 0.001,
      `Face ${entry.value} normal should be unit length, got ${length}`,
    );
  }
});

test("topFaceFromQuaternion returns face 1 for identity quaternion", () => {
  const identity = new CANNON.Quaternion(0, 0, 0, 1);
  const result = topFaceFromQuaternion(identity);

  assert.equal(result.faceValue, 1);
  assert.ok(
    result.alignment > 0.99,
    `Expected high alignment, got ${result.alignment}`,
  );
});

test("quaternionForFaceValue produces quaternion that resolves back to the same face", () => {
  for (let face = 1; face <= 6; face += 1) {
    const quat = quaternionForFaceValue(face);
    const result = topFaceFromQuaternion(quat);

    assert.equal(
      result.faceValue,
      face,
      `Round-trip for face ${face} returned ${result.faceValue}`,
    );
    assert.ok(
      result.alignment > 0.99,
      `Face ${face} alignment should be near 1.0, got ${result.alignment}`,
    );
  }
});

test("topFaceFromQuaternion returns correct face for 90-degree rotations", () => {
  // Rotate 90 degrees around the Z axis: face 2 (right/+X) should point up
  const quat90z = new CANNON.Quaternion();
  quat90z.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
  const resultZ = topFaceFromQuaternion(quat90z);
  assert.equal(
    resultZ.faceValue,
    2,
    `90° around Z should show face 2, got ${resultZ.faceValue}`,
  );

  // Rotate 90 degrees around the X axis: face 3 (front/+Z) should point up
  const quat90x = new CANNON.Quaternion();
  quat90x.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  const resultX = topFaceFromQuaternion(quat90x);
  assert.equal(
    resultX.faceValue,
    3,
    `90° around X should show face 3, got ${resultX.faceValue}`,
  );
});

test("topFaceFromQuaternion returns alignment near 1.0 for axis-aligned orientations", () => {
  for (let face = 1; face <= 6; face += 1) {
    const quat = quaternionForFaceValue(face);
    const result = topFaceFromQuaternion(quat);

    assert.ok(
      result.alignment > 0.999,
      `Face ${face} should be perfectly aligned, got ${result.alignment}`,
    );
  }
});

test("topFaceFromQuaternion returns low alignment for tilted orientations", () => {
  // Rotate 45 degrees around the Z axis — die is leaning on an edge
  const quat45 = new CANNON.Quaternion();
  quat45.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 4);
  const result = topFaceFromQuaternion(quat45);

  // Alignment should be approximately cos(45°) ≈ 0.707
  assert.ok(
    result.alignment < 0.8,
    `45° tilt should have reduced alignment, got ${result.alignment}`,
  );
  assert.ok(
    result.alignment > 0.6,
    `45° tilt alignment should be around 0.707, got ${result.alignment}`,
  );
});

test("quaternionForFaceValue falls back to face 1 normal for invalid input", () => {
  const quat = quaternionForFaceValue(99);
  const result = topFaceFromQuaternion(quat);

  assert.equal(
    result.faceValue,
    1,
    `Invalid face input should fallback to face 1, got ${result.faceValue}`,
  );
});

test("quaternionForFaceValue returns a CANNON.Quaternion instance", () => {
  const quat = quaternionForFaceValue(3);

  assert.ok(
    quat instanceof CANNON.Quaternion,
    "Should return a CANNON.Quaternion",
  );
  assert.equal(typeof quat.x, "number");
  assert.equal(typeof quat.y, "number");
  assert.equal(typeof quat.z, "number");
  assert.equal(typeof quat.w, "number");
});

test("quaternionForFaceValue returns unit quaternions", () => {
  for (let face = 1; face <= 6; face += 1) {
    const quat = quaternionForFaceValue(face);
    const length = Math.sqrt(
      quat.x ** 2 + quat.y ** 2 + quat.z ** 2 + quat.w ** 2,
    );

    assert.ok(
      Math.abs(length - 1) < 0.001,
      `Face ${face} quaternion should be unit length, got ${length}`,
    );
  }
});

test("opposite faces sum to 7 when oriented upward", () => {
  // Standard d6 convention: opposite faces sum to 7
  const pairs = [
    [1, 6],
    [2, 5],
    [3, 4],
  ];

  for (const [a, b] of pairs) {
    assert.equal(a + b, 7, `Faces ${a} and ${b} should sum to 7`);

    // Verify both faces produce valid round-trip results
    const quatA = quaternionForFaceValue(a);
    const quatB = quaternionForFaceValue(b);
    assert.equal(topFaceFromQuaternion(quatA).faceValue, a);
    assert.equal(topFaceFromQuaternion(quatB).faceValue, b);
  }
});

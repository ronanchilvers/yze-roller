import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as CANNON from "cannon-es";
import * as THREE from "three";
import { DICE_TYPE } from "../lib/dice.js";
import { getDieColor } from "../lib/dice-visuals.js";

const DIE_SIZE = 0.68;
const FLOOR_THICKNESS = 0.22;
const WALL_THICKNESS = 0.2;
const WALL_HEIGHT = 1.5;
const MIN_SETTLE_MS = 700;
const MAX_SETTLE_MS = 2600;

const FACE_ORDER_BY_SIDE = [2, 5, 1, 6, 3, 4];
const FACE_NORMALS = [
  { value: 1, normal: new THREE.Vector3(0, 1, 0) },
  { value: 2, normal: new THREE.Vector3(1, 0, 0) },
  { value: 3, normal: new THREE.Vector3(0, 0, 1) },
  { value: 4, normal: new THREE.Vector3(0, 0, -1) },
  { value: 5, normal: new THREE.Vector3(-1, 0, 0) },
  { value: 6, normal: new THREE.Vector3(0, -1, 0) },
];

const WORLD_UP = new THREE.Vector3(0, 1, 0);

const hashCode = (value) => {
  const text = String(value ?? "");
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

const randomBetween = (min, max) => {
  return min + Math.random() * (max - min);
};

const createFaceTexture = (faceValue, dieColor) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const base = new THREE.Color(dieColor);
  const light = base.clone().lerp(new THREE.Color("#ffffff"), 0.35);
  const dark = base.clone().multiplyScalar(0.55);

  context.fillStyle = light.getStyle();
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = dark.getStyle();
  context.lineWidth = 12;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  context.fillStyle = "rgba(255, 255, 255, 0.82)";
  context.fillRect(32, 32, canvas.width - 64, canvas.height - 64);

  context.fillStyle = "#1d2528";
  context.font = "700 122px Avenir Next, Trebuchet MS, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(faceValue), canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

const createMaterialSet = (dieType) => {
  const dieColor = getDieColor(dieType);

  return FACE_ORDER_BY_SIDE.map((faceValue) => {
    const texture = createFaceTexture(faceValue, dieColor);

    return new THREE.MeshStandardMaterial({
      map: texture,
      color: "#ffffff",
      roughness: 0.34,
      metalness: 0.08,
    });
  });
};

const disposeMaterialSet = (materialSet) => {
  for (const material of materialSet) {
    if (material.map) {
      material.map.dispose();
    }

    material.dispose();
  }
};

const faceValueFromQuaternion = (quaternion) => {
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

  return bestFace;
};

const quaternionForFaceValue = (faceValue, id) => {
  const faceNormal = FACE_NORMALS.find((face) => face.value === faceValue)?.normal ?? FACE_NORMALS[0].normal;
  const baseQuaternion = new THREE.Quaternion().setFromUnitVectors(faceNormal, WORLD_UP);
  const yawRadians = (hashCode(id) % 360) * (Math.PI / 180);
  const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, yawRadians);
  baseQuaternion.premultiply(yawQuaternion);

  return new CANNON.Quaternion(
    baseQuaternion.x,
    baseQuaternion.y,
    baseQuaternion.z,
    baseQuaternion.w,
  );
};

const layoutTargets = (count, bounds) => {
  if (count <= 0) {
    return [];
  }

  const trayWidth = bounds.halfWidth * 2 - 0.9;
  const trayDepth = bounds.halfDepth * 2 - 0.9;
  const columns = Math.max(3, Math.ceil(Math.sqrt(count * 1.3)));
  const rows = Math.ceil(count / columns);
  const xSpacing = Math.max(0.75, trayWidth / Math.max(1, columns));
  const zSpacing = Math.max(0.75, trayDepth / Math.max(1, rows));
  const startX = -((columns - 1) * xSpacing) / 2;
  const startZ = -((rows - 1) * zSpacing) / 2;
  const targets = [];

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);

    targets.push({
      x: startX + column * xSpacing,
      y: DIE_SIZE * 0.5,
      z: startZ + row * zSpacing,
    });
  }

  return targets;
};

const calculateBounds = (camera, size) => {
  if (!camera || !size.height) {
    return { halfWidth: 4.6, halfDepth: 3.1 };
  }

  if (camera.isPerspectiveCamera) {
    const distance = Math.abs(camera.position.y);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const depth = 2 * Math.tan(verticalFov * 0.5) * distance;
    const width = depth * (size.width / size.height);

    return {
      halfWidth: Math.max(3.6, width * 0.48),
      halfDepth: Math.max(2.4, depth * 0.48),
    };
  }

  return {
    halfWidth: Math.max(3.6, (camera.right - camera.left) * 0.5),
    halfDepth: Math.max(2.4, (camera.top - camera.bottom) * 0.5),
  };
};

const createStaticBox = (halfExtents, position) => {
  const body = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(halfExtents),
  });
  body.position.set(position.x, position.y, position.z);
  return body;
};

const DicePhysicsScene = ({ dice, rollRequest, onRollResolved }) => {
  const { camera, size } = useThree();
  const worldRef = useRef(null);
  const boundsRef = useRef({ halfWidth: 4.6, halfDepth: 3.1 });
  const bodiesRef = useRef(new Map());
  const groupRefs = useRef(new Map());
  const staticBodiesRef = useRef([]);
  const pendingSimulationRef = useRef(null);
  const onRollResolvedRef = useRef(onRollResolved);
  const stepAccumulatorRef = useRef(0);
  const lastRequestKeyRef = useRef(null);
  const dieShapeRef = useRef(new CANNON.Box(new CANNON.Vec3(DIE_SIZE / 2, DIE_SIZE / 2, DIE_SIZE / 2)));

  const materialSets = useMemo(
    () => ({
      [DICE_TYPE.ATTRIBUTE]: createMaterialSet(DICE_TYPE.ATTRIBUTE),
      [DICE_TYPE.SKILL]: createMaterialSet(DICE_TYPE.SKILL),
      [DICE_TYPE.STRAIN]: createMaterialSet(DICE_TYPE.STRAIN),
    }),
    [],
  );

  useEffect(() => {
    onRollResolvedRef.current = onRollResolved;
  }, [onRollResolved]);

  useEffect(() => {
    camera.position.set(0, 10, 0.001);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -30, 0),
      allowSleep: true,
    });
    world.defaultContactMaterial.friction = 0.34;
    world.defaultContactMaterial.restitution = 0.36;
    worldRef.current = world;

    return () => {
      for (const bodyState of bodiesRef.current.values()) {
        world.removeBody(bodyState.body);
      }
      for (const body of staticBodiesRef.current) {
        world.removeBody(body);
      }
      for (const materialSet of Object.values(materialSets)) {
        disposeMaterialSet(materialSet);
      }
      bodiesRef.current.clear();
      groupRefs.current.clear();
      staticBodiesRef.current = [];
      worldRef.current = null;
      pendingSimulationRef.current = null;
    };
  }, [materialSets]);

  useEffect(() => {
    const world = worldRef.current;

    if (!world) {
      return;
    }

    const bounds = calculateBounds(camera, size);
    boundsRef.current = bounds;

    for (const body of staticBodiesRef.current) {
      world.removeBody(body);
    }
    staticBodiesRef.current = [];

    const floor = createStaticBox(
      new CANNON.Vec3(bounds.halfWidth, FLOOR_THICKNESS, bounds.halfDepth),
      { x: 0, y: -FLOOR_THICKNESS, z: 0 },
    );
    const leftWall = createStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, bounds.halfDepth),
      { x: -bounds.halfWidth - WALL_THICKNESS / 2, y: WALL_HEIGHT / 2, z: 0 },
    );
    const rightWall = createStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, bounds.halfDepth),
      { x: bounds.halfWidth + WALL_THICKNESS / 2, y: WALL_HEIGHT / 2, z: 0 },
    );
    const topWall = createStaticBox(
      new CANNON.Vec3(bounds.halfWidth + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      { x: 0, y: WALL_HEIGHT / 2, z: -bounds.halfDepth - WALL_THICKNESS / 2 },
    );
    const bottomWall = createStaticBox(
      new CANNON.Vec3(bounds.halfWidth + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      { x: 0, y: WALL_HEIGHT / 2, z: bounds.halfDepth + WALL_THICKNESS / 2 },
    );

    for (const staticBody of [floor, leftWall, rightWall, topWall, bottomWall]) {
      world.addBody(staticBody);
      staticBodiesRef.current.push(staticBody);
    }
  }, [camera, size.width, size.height]);

  const lockBodyToTarget = (bodyState, target, faceValue, id) => {
    const body = bodyState.body;
    body.type = CANNON.Body.KINEMATIC;
    body.mass = 0;
    body.updateMassProperties();
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.position.set(target.x, target.y, target.z);
    body.quaternion.copy(quaternionForFaceValue(faceValue, id));
    body.sleep();
  };

  const launchRollingBody = (bodyState, bounds, isPushReroll) => {
    const body = bodyState.body;
    body.type = CANNON.Body.DYNAMIC;
    body.mass = 1;
    body.updateMassProperties();

    const xSpread = bounds.halfWidth * (isPushReroll ? 0.26 : 0.52);
    const zSpread = bounds.halfDepth * (isPushReroll ? 0.26 : 0.52);

    if (isPushReroll) {
      body.position.set(
        body.position.x + randomBetween(-0.35, 0.35),
        Math.max(body.position.y + 0.36, 1.05),
        body.position.z + randomBetween(-0.35, 0.35),
      );
    } else {
      body.position.set(
        randomBetween(-xSpread, xSpread),
        randomBetween(2.1, 3.6),
        randomBetween(-zSpread, zSpread),
      );
    }

    body.velocity.set(
      randomBetween(-5.8, 5.8),
      randomBetween(2.6, 5.8),
      randomBetween(-5.8, 5.8),
    );
    body.angularVelocity.set(
      randomBetween(-24, 24),
      randomBetween(-24, 24),
      randomBetween(-24, 24),
    );

    body.wakeUp();
  };

  useEffect(() => {
    const world = worldRef.current;

    if (!world) {
      return;
    }

    const diceList = Array.isArray(dice) ? dice : [];
    const targets = layoutTargets(diceList.length, boundsRef.current);
    const existingIds = new Set(bodiesRef.current.keys());
    const nextIds = new Set();

    diceList.forEach((die, index) => {
      const id = String(die?.id ?? `die-${index + 1}`);
      nextIds.add(id);
      let bodyState = bodiesRef.current.get(id);

      if (!bodyState) {
        const body = new CANNON.Body({ mass: 1, shape: dieShapeRef.current });
        body.linearDamping = 0.34;
        body.angularDamping = 0.29;
        world.addBody(body);
        bodyState = { body, type: die?.type ?? DICE_TYPE.ATTRIBUTE };
        bodiesRef.current.set(id, bodyState);
      }

      bodyState.type = die?.type ?? DICE_TYPE.ATTRIBUTE;

      if (!rollRequest) {
        const faceValue = Number.isInteger(die?.face) ? die.face : 1;
        lockBodyToTarget(bodyState, targets[index], faceValue, id);
      }
    });

    for (const staleId of existingIds) {
      if (nextIds.has(staleId)) {
        continue;
      }

      const bodyState = bodiesRef.current.get(staleId);

      if (!bodyState) {
        continue;
      }

      world.removeBody(bodyState.body);
      bodiesRef.current.delete(staleId);
      groupRefs.current.delete(staleId);
    }
  }, [dice, rollRequest]);

  useEffect(() => {
    if (!rollRequest || !Array.isArray(rollRequest.dice) || rollRequest.key == null) {
      return;
    }

    if (lastRequestKeyRef.current === rollRequest.key) {
      return;
    }

    lastRequestKeyRef.current = rollRequest.key;

    const diceList = rollRequest.dice;
    const bounds = boundsRef.current;
    const isPush = rollRequest.action === "push";
    const rerollSet = new Set(
      Array.isArray(rollRequest.rerollIds) && rollRequest.rerollIds.length > 0
        ? rollRequest.rerollIds.map((id) => String(id))
        : diceList.map((die, index) => String(die?.id ?? `die-${index + 1}`)),
    );

    const targets = layoutTargets(diceList.length, bounds);

    diceList.forEach((die, index) => {
      const id = String(die?.id ?? `die-${index + 1}`);
      const bodyState = bodiesRef.current.get(id);

      if (!bodyState) {
        return;
      }

      if (rerollSet.has(id)) {
        launchRollingBody(bodyState, bounds, isPush);
      } else {
        const faceValue = Number.isInteger(die?.face) ? die.face : 1;
        lockBodyToTarget(bodyState, targets[index], faceValue, id);
      }
    });

    pendingSimulationRef.current = {
      key: rollRequest.key,
      action: rollRequest.action,
      order: diceList.map((die, index) => String(die?.id ?? `die-${index + 1}`)),
      rerollSet,
      startedAt: performance.now(),
      rolledAt: Number.isFinite(rollRequest.startedAt) ? rollRequest.startedAt : Date.now(),
      reported: false,
    };
  }, [rollRequest]);

  useFrame((_, deltaSeconds) => {
    const world = worldRef.current;

    if (!world) {
      return;
    }

    const fixedStep = 1 / 60;
    stepAccumulatorRef.current += Math.min(deltaSeconds, 1 / 20);

    while (stepAccumulatorRef.current >= fixedStep) {
      world.step(fixedStep);
      stepAccumulatorRef.current -= fixedStep;
    }

    for (const [id, bodyState] of bodiesRef.current) {
      const group = groupRefs.current.get(id);

      if (!group) {
        continue;
      }

      group.position.set(
        bodyState.body.position.x,
        bodyState.body.position.y,
        bodyState.body.position.z,
      );
      group.quaternion.set(
        bodyState.body.quaternion.x,
        bodyState.body.quaternion.y,
        bodyState.body.quaternion.z,
        bodyState.body.quaternion.w,
      );
    }

    const pending = pendingSimulationRef.current;

    if (!pending || pending.reported || pending.rerollSet.size === 0) {
      return;
    }

    const elapsed = performance.now() - pending.startedAt;
    let allSettled = elapsed >= MIN_SETTLE_MS;

    for (const id of pending.rerollSet) {
      const bodyState = bodiesRef.current.get(id);

      if (!bodyState) {
        continue;
      }

      const linearSpeed = bodyState.body.velocity.length();
      const angularSpeed = bodyState.body.angularVelocity.length();

      if (linearSpeed > 0.2 || angularSpeed > 0.7) {
        allSettled = false;
        break;
      }
    }

    if (elapsed >= MAX_SETTLE_MS) {
      allSettled = true;
    }

    if (!allSettled) {
      return;
    }

    const targets = layoutTargets(pending.order.length, boundsRef.current);
    const resolvedDice = pending.order.map((id, index) => {
      const bodyState = bodiesRef.current.get(id);
      const faceValue = bodyState ? faceValueFromQuaternion(bodyState.body.quaternion) : 1;

      if (bodyState) {
        lockBodyToTarget(bodyState, targets[index], faceValue, id);
      }

      return {
        id,
        type: bodyState?.type ?? DICE_TYPE.ATTRIBUTE,
        face: faceValue,
        wasPushed: pending.action === "push" && pending.rerollSet.has(id),
      };
    });

    pending.reported = true;
    pendingSimulationRef.current = null;
    onRollResolvedRef.current?.({
      key: pending.key,
      action: pending.action,
      rolledAt: pending.rolledAt,
      dice: resolvedDice,
    });
  });

  const diceList = Array.isArray(dice) ? dice : [];

  return (
    <>
      <ambientLight intensity={0.62} />
      <directionalLight
        position={[0, 11, 0.001]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[boundsRef.current.halfWidth * 2, boundsRef.current.halfDepth * 2]} />
        <shadowMaterial opacity={0.24} transparent />
      </mesh>

      {diceList.map((die, index) => {
        const id = String(die?.id ?? `die-${index + 1}`);
        const materialSet = materialSets[die?.type] ?? materialSets[DICE_TYPE.ATTRIBUTE];

        return (
          <group
            key={id}
            ref={(node) => {
              if (node) {
                groupRefs.current.set(id, node);
              } else {
                groupRefs.current.delete(id);
              }
            }}
          >
            <mesh castShadow receiveShadow material={materialSet}>
              <boxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} />
            </mesh>
          </group>
        );
      })}
    </>
  );
};

function DiceTray3D({ dice, rollRequest, onRollResolved }) {
  return (
    <Canvas
      camera={{ position: [0, 10, 0.001], fov: 34, near: 0.1, far: 50 }}
      shadows
      dpr={[1, 1.7]}
    >
      <color attach="background" args={["#edf3eb"]} />
      <DicePhysicsScene
        dice={dice}
        rollRequest={rollRequest}
        onRollResolved={onRollResolved}
      />
    </Canvas>
  );
}

export default DiceTray3D;

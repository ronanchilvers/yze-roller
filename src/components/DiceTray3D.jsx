import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as CANNON from "cannon-es";
import * as THREE from "three";
import { DICE_TYPE } from "../lib/dice.js";
import { getDieColor } from "../lib/dice-visuals.js";

const DIE_SIZE = 0.68;
const FLOOR_THICKNESS = 0.24;
const WALL_THICKNESS = 0.24;
const WALL_HEIGHT = 3.2;
const MIN_SETTLE_MS = 720;
const MAX_SETTLE_MS = 4200;
const SETTLE_LINEAR_SPEED = 0.08;
const SETTLE_ANGULAR_SPEED = 0.2;
const SETTLE_FACE_ALIGNMENT = 0.9;
const SETTLE_REST_Y = DIE_SIZE * 0.5 + 0.03;

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
  context.fillStyle = base.getStyle();
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
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

const topFaceFromQuaternion = (quaternion) => {
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

const quaternionForFaceValue = (faceValue) => {
  const faceNormal = FACE_NORMALS.find((face) => face.value === faceValue)?.normal ?? FACE_NORMALS[0].normal;
  const baseQuaternion = new THREE.Quaternion().setFromUnitVectors(faceNormal, WORLD_UP);

  return new CANNON.Quaternion(
    baseQuaternion.x,
    baseQuaternion.y,
    baseQuaternion.z,
    baseQuaternion.w,
  );
};

const calculateBounds = (camera, size) => {
  let visibleHalfWidth = 4.6;
  let visibleHalfDepth = 3.1;

  if (camera?.isOrthographicCamera) {
    const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
    visibleHalfWidth = Math.max(2.8, (camera.right - camera.left) / (2 * zoom));
    visibleHalfDepth = Math.max(2.2, (camera.top - camera.bottom) / (2 * zoom));
  } else if (camera?.isPerspectiveCamera && size.height) {
    const distance = Math.abs(camera.position.y);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const visibleDepth = 2 * Math.tan(verticalFov * 0.5) * distance;
    const visibleWidth = visibleDepth * (size.width / size.height);
    visibleHalfWidth = Math.max(2.8, visibleWidth * 0.48);
    visibleHalfDepth = Math.max(2.2, visibleDepth * 0.48);
  }

  const innerMargin = DIE_SIZE * 0.74 + WALL_THICKNESS;

  return {
    visibleHalfWidth,
    visibleHalfDepth,
    innerHalfWidth: Math.max(1.4, visibleHalfWidth - innerMargin),
    innerHalfDepth: Math.max(1.2, visibleHalfDepth - innerMargin),
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

const freezeBodyInPlace = (body) => {
  body.type = CANNON.Body.KINEMATIC;
  body.mass = 0;
  body.updateMassProperties();
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.sleep();
};

const clampBodyInside = (body, bounds, allowBounce = true) => {
  const xLimit = Math.max(0.8, bounds.innerHalfWidth - DIE_SIZE * 0.5);
  const zLimit = Math.max(0.8, bounds.innerHalfDepth - DIE_SIZE * 0.5);
  const minY = DIE_SIZE * 0.5;

  if (body.position.x > xLimit) {
    body.position.x = xLimit;

    if (allowBounce && body.velocity.x > 0) {
      body.velocity.x *= -0.35;
    }
  }

  if (body.position.x < -xLimit) {
    body.position.x = -xLimit;

    if (allowBounce && body.velocity.x < 0) {
      body.velocity.x *= -0.35;
    }
  }

  if (body.position.z > zLimit) {
    body.position.z = zLimit;

    if (allowBounce && body.velocity.z > 0) {
      body.velocity.z *= -0.35;
    }
  }

  if (body.position.z < -zLimit) {
    body.position.z = -zLimit;

    if (allowBounce && body.velocity.z < 0) {
      body.velocity.z *= -0.35;
    }
  }

  if (body.position.y < minY) {
    body.position.y = minY;

    if (body.velocity.y < 0) {
      body.velocity.y = allowBounce ? body.velocity.y * -0.02 : 0;
    }
  }
};

const spawnBodyInViewport = (body, bounds) => {
  body.position.set(
    randomBetween(-bounds.innerHalfWidth * 0.44, bounds.innerHalfWidth * 0.44),
    DIE_SIZE * 0.5,
    randomBetween(-bounds.innerHalfDepth * 0.44, bounds.innerHalfDepth * 0.44),
  );
};

const launchRollingBody = (body, bounds, isPushReroll) => {
  body.type = CANNON.Body.DYNAMIC;
  body.mass = 1;
  body.updateMassProperties();

  const xSpread = bounds.innerHalfWidth * (isPushReroll ? 0.32 : 0.58);
  const zSpread = bounds.innerHalfDepth * (isPushReroll ? 0.32 : 0.58);

  if (isPushReroll) {
    body.position.set(
      body.position.x + randomBetween(-0.32, 0.32),
      Math.max(body.position.y + 1.8, 3.2),
      body.position.z + randomBetween(-0.32, 0.32),
    );
  } else {
    body.position.set(
      randomBetween(-xSpread, xSpread),
      randomBetween(9.2, 13.8),
      randomBetween(-zSpread, zSpread),
    );
  }

  body.velocity.set(
    randomBetween(-6.4, 6.4),
    randomBetween(4.2, 7.9),
    randomBetween(-6.4, 6.4),
  );
  body.angularVelocity.set(
    randomBetween(-26, 26),
    randomBetween(-26, 26),
    randomBetween(-26, 26),
  );

  body.wakeUp();
};

const DicePhysicsScene = ({ dice, rollRequest, onRollResolved }) => {
  const { camera, size } = useThree();
  const worldRef = useRef(null);
  const boundsRef = useRef(calculateBounds(camera, size));
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
    camera.position.set(0, 16, 0.001);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -30, 0),
      allowSleep: true,
    });
    world.defaultContactMaterial.friction = 0.52;
    world.defaultContactMaterial.restitution = 0.2;
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
      new CANNON.Vec3(bounds.innerHalfWidth + WALL_THICKNESS, FLOOR_THICKNESS, bounds.innerHalfDepth + WALL_THICKNESS),
      { x: 0, y: -FLOOR_THICKNESS, z: 0 },
    );
    const leftWall = createStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, bounds.innerHalfDepth + WALL_THICKNESS),
      { x: -bounds.innerHalfWidth - WALL_THICKNESS / 2, y: WALL_HEIGHT / 2, z: 0 },
    );
    const rightWall = createStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, bounds.innerHalfDepth + WALL_THICKNESS),
      { x: bounds.innerHalfWidth + WALL_THICKNESS / 2, y: WALL_HEIGHT / 2, z: 0 },
    );
    const topWall = createStaticBox(
      new CANNON.Vec3(bounds.innerHalfWidth + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      { x: 0, y: WALL_HEIGHT / 2, z: -bounds.innerHalfDepth - WALL_THICKNESS / 2 },
    );
    const bottomWall = createStaticBox(
      new CANNON.Vec3(bounds.innerHalfWidth + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      { x: 0, y: WALL_HEIGHT / 2, z: bounds.innerHalfDepth + WALL_THICKNESS / 2 },
    );

    for (const staticBody of [floor, leftWall, rightWall, topWall, bottomWall]) {
      world.addBody(staticBody);
      staticBodiesRef.current.push(staticBody);
    }

    for (const bodyState of bodiesRef.current.values()) {
      clampBodyInside(bodyState.body, bounds, false);
    }
  }, [camera, size.width, size.height]);

  useEffect(() => {
    const world = worldRef.current;

    if (!world) {
      return;
    }

    const diceList = Array.isArray(dice) ? dice : [];
    const existingIds = new Set(bodiesRef.current.keys());
    const nextIds = new Set();

    diceList.forEach((die, index) => {
      const id = String(die?.id ?? `die-${index + 1}`);
      nextIds.add(id);
      let bodyState = bodiesRef.current.get(id);

      if (!bodyState) {
        const body = new CANNON.Body({ mass: 1, shape: dieShapeRef.current });
        body.linearDamping = 0.42;
        body.angularDamping = 0.56;
        body.ccdSpeedThreshold = 0.1;
        body.ccdIterations = 8;
        spawnBodyInViewport(body, boundsRef.current);
        const initialFace = Number.isInteger(die?.face) ? die.face : 1;
        body.quaternion.copy(quaternionForFaceValue(initialFace));
        freezeBodyInPlace(body);
        world.addBody(body);
        bodyState = { body, type: die?.type ?? DICE_TYPE.ATTRIBUTE };
        bodiesRef.current.set(id, bodyState);
      }

      bodyState.type = die?.type ?? DICE_TYPE.ATTRIBUTE;

      if (!rollRequest && bodyState.body.type !== CANNON.Body.DYNAMIC) {
        clampBodyInside(bodyState.body, boundsRef.current, false);
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

    diceList.forEach((die, index) => {
      const id = String(die?.id ?? `die-${index + 1}`);
      const bodyState = bodiesRef.current.get(id);

      if (!bodyState) {
        return;
      }

      if (rerollSet.has(id)) {
        launchRollingBody(bodyState.body, bounds, isPush);
      } else {
        freezeBodyInPlace(bodyState.body);
        clampBodyInside(bodyState.body, bounds, false);
      }
    });

    if (rerollSet.size === 0) {
      onRollResolvedRef.current?.({
        key: rollRequest.key,
        action: rollRequest.action,
        rolledAt: Number.isFinite(rollRequest.startedAt) ? rollRequest.startedAt : Date.now(),
        dice: diceList.map((die, index) => ({
          id: String(die?.id ?? `die-${index + 1}`),
          type: die?.type ?? DICE_TYPE.ATTRIBUTE,
          face: Number.isInteger(die?.face) ? die.face : 1,
          wasPushed: false,
        })),
      });
      return;
    }

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
      if (bodyState.body.type === CANNON.Body.DYNAMIC) {
        clampBodyInside(bodyState.body, boundsRef.current, true);
      }

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

    if (!pending || pending.reported) {
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
      const { alignment } = topFaceFromQuaternion(bodyState.body.quaternion);
      const isNearFloor = bodyState.body.position.y <= SETTLE_REST_Y;

      if (
        linearSpeed > SETTLE_LINEAR_SPEED ||
        angularSpeed > SETTLE_ANGULAR_SPEED ||
        alignment < SETTLE_FACE_ALIGNMENT ||
        !isNearFloor
      ) {
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

    const resolvedDice = pending.order.map((id) => {
      const bodyState = bodiesRef.current.get(id);
      const faceValue = bodyState ? topFaceFromQuaternion(bodyState.body.quaternion).faceValue : 1;

      if (bodyState) {
        clampBodyInside(bodyState.body, boundsRef.current, false);
        freezeBodyInPlace(bodyState.body);
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
      <ambientLight intensity={0.64} />
      <directionalLight
        position={[8, 11.31, -8]}
        intensity={0.92}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-blurSamples={48}
      />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[boundsRef.current.visibleHalfWidth * 2, boundsRef.current.visibleHalfDepth * 2]} />
        <meshStandardMaterial color="#f2f8ef" roughness={0.94} metalness={0.02} />
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
      orthographic
      camera={{ position: [0, 16, 0.001], zoom: 88, near: 0.1, far: 70 }}
      shadows={{ type: THREE.VSMShadowMap }}
      dpr={[1, 1.7]}
    >
      <color attach="background" args={["#f8fcf6"]} />
      <DicePhysicsScene
        dice={dice}
        rollRequest={rollRequest}
        onRollResolved={onRollResolved}
      />
    </Canvas>
  );
}

export default DiceTray3D;

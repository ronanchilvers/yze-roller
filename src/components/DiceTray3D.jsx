import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as CANNON from "cannon-es";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DICE_TYPE, getDieId } from "../lib/dice.js";
import {
  FACE_ORDER_BY_SIDE,
  createFeltTexture,
  createMaterialSet,
  disposeMaterialSet,
} from "../lib/textures.js";
import {
  DIE_SIZE,
  createStaticBox,
  freezeBodyInPlace,
  clampBodyInside,
  spawnBodyInViewport,
  launchRollingBody,
  nudgeEdgeLeaningDie,
} from "../lib/physics.js";
import {
  topFaceFromQuaternion,
  quaternionForFaceValue,
} from "../lib/face-mapping.js";
import { isValidRollRequest } from "../lib/roll-session.js";
import { calculateBounds } from "../lib/viewport-bounds.js";

const CHAMFER_SEGMENTS = 3;
const CHAMFER_RADIUS = DIE_SIZE * 0.08;
const FLOOR_THICKNESS = 0.24;
const WALL_THICKNESS = 0.24;
const WALL_HEIGHT = 3.2;
const CAMERA_DISTANCE = 16;
const CAMERA_TILT_DEGREES = 15;
const CAMERA_TILT_RADIANS = THREE.MathUtils.degToRad(CAMERA_TILT_DEGREES);
const CAMERA_Y = CAMERA_DISTANCE * Math.cos(CAMERA_TILT_RADIANS);
const CAMERA_Z = CAMERA_DISTANCE * Math.sin(CAMERA_TILT_RADIANS);
const FELT_PLANE_SCALE = 3;
const MIN_SETTLE_MS = 720;
const MAX_SETTLE_MS = 4200;
const SETTLE_LINEAR_SPEED = 0.12;
const SETTLE_ANGULAR_SPEED = 0.18;
const SETTLE_FRAMES = 18;
const SETTLE_FACE_ALIGNMENT = 0.9;
const EDGE_NUDGE_COOLDOWN_MS = 140;
const EDGE_NUDGE_MAX_ATTEMPTS = 10;

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
  const settleFramesRef = useRef(0);
  const lastRequestKeyRef = useRef(null);
  const dieShapeRef = useRef(new CANNON.Box(new CANNON.Vec3(DIE_SIZE / 2, DIE_SIZE / 2, DIE_SIZE / 2)));
  const dieGeometry = useMemo(
    () => new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, CHAMFER_SEGMENTS, CHAMFER_RADIUS),
    [],
  );
  const feltTexture = useMemo(() => createFeltTexture(FELT_PLANE_SCALE), []);

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
    camera.position.set(0, CAMERA_Y, CAMERA_Z);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -30, 0),
      allowSleep: true,
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 8;
    world.defaultContactMaterial.friction = 0.35;
    world.defaultContactMaterial.restitution = 0.18;
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
      dieGeometry.dispose();
      feltTexture?.dispose();
      bodiesRef.current.clear();
      groupRefs.current.clear();
      staticBodiesRef.current = [];
      worldRef.current = null;
      pendingSimulationRef.current = null;
    };
  }, [materialSets, dieGeometry, feltTexture]);

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
      const id = getDieId(die, index);
      nextIds.add(id);
      let bodyState = bodiesRef.current.get(id);

      if (!bodyState) {
        const body = new CANNON.Body({ mass: 1, shape: dieShapeRef.current });
        body.linearDamping = 0.12;
        body.angularDamping = 0.16;
        body.allowSleep = true;
        body.sleepSpeedLimit = 0.08;
        body.sleepTimeLimit = 0.2;
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
    // Validate rollRequest shape at component boundary
    if (!isValidRollRequest(rollRequest)) {
      if (rollRequest) {
        console.warn("Invalid rollRequest received in DiceTray3D:", rollRequest);
      }
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
        : diceList.map((die, index) => getDieId(die, index)),
    );

    diceList.forEach((die, index) => {
      const id = getDieId(die, index);
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
          id: getDieId(die, index),
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
      order: diceList.map((die, index) => getDieId(die, index)),
      rerollSet,
      startedAt: performance.now(),
      rolledAt: Number.isFinite(rollRequest.startedAt) ? rollRequest.startedAt : Date.now(),
      lastNudgeAt: 0,
      nudgeAttempts: 0,
      reported: false,
    };
    settleFramesRef.current = 0;
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
    let isMoving = false;
    let hasEdgeLeaningDie = false;
    const edgeLeaningBodies = [];

    for (const id of pending.rerollSet) {
      const bodyState = bodiesRef.current.get(id);

      if (!bodyState) {
        continue;
      }

      const linearSpeedSq = bodyState.body.velocity.lengthSquared();
      const angularSpeedSq = bodyState.body.angularVelocity.lengthSquared();
      const { alignment } = topFaceFromQuaternion(bodyState.body.quaternion);

      if (
        linearSpeedSq > SETTLE_LINEAR_SPEED * SETTLE_LINEAR_SPEED ||
        angularSpeedSq > SETTLE_ANGULAR_SPEED * SETTLE_ANGULAR_SPEED
      ) {
        isMoving = true;
        break;
      }

      if (alignment < SETTLE_FACE_ALIGNMENT) {
        hasEdgeLeaningDie = true;
        edgeLeaningBodies.push(bodyState.body);
      }
    }

    if (isMoving) {
      settleFramesRef.current = 0;
    } else {
      settleFramesRef.current += 1;
    }

    let allSettled = elapsed >= MIN_SETTLE_MS
      && settleFramesRef.current >= SETTLE_FRAMES
      && !hasEdgeLeaningDie;

    if (
      hasEdgeLeaningDie
      && !isMoving
      && pending.nudgeAttempts < EDGE_NUDGE_MAX_ATTEMPTS
      && elapsed >= MIN_SETTLE_MS
      && performance.now() - pending.lastNudgeAt >= EDGE_NUDGE_COOLDOWN_MS
    ) {
      for (const body of edgeLeaningBodies) {
        nudgeEdgeLeaningDie(body);
      }
      pending.lastNudgeAt = performance.now();
      pending.nudgeAttempts += 1;
      settleFramesRef.current = 0;
      allSettled = false;
    } else if (elapsed >= MAX_SETTLE_MS && hasEdgeLeaningDie && pending.nudgeAttempts >= EDGE_NUDGE_MAX_ATTEMPTS) {
      allSettled = true;
    } else if (elapsed >= MAX_SETTLE_MS && !hasEdgeLeaningDie) {
      allSettled = true;
    }

    if (!allSettled) {
      return;
    }

    const resolvedDice = pending.order.map((id) => {
      const bodyState = bodiesRef.current.get(id);
      const resolvedFace = bodyState ? topFaceFromQuaternion(bodyState.body.quaternion) : null;
      const faceValue = resolvedFace?.faceValue ?? 1;

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
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[6, 8, 4]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-radius={4}
      />
      <directionalLight position={[-3, 5, -2]} intensity={0.3} />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry
          args={[
            boundsRef.current.visibleHalfWidth * 2 * FELT_PLANE_SCALE,
            boundsRef.current.visibleHalfDepth * 2 * FELT_PLANE_SCALE,
          ]}
        />
        <meshStandardMaterial
          color="#ffffff"
          map={feltTexture}
          roughness={0.98}
          metalness={0}
        />
      </mesh>

      {diceList.map((die, index) => {
        const id = getDieId(die, index);
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
            <mesh castShadow receiveShadow material={materialSet} geometry={dieGeometry} />
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
      camera={{ position: [0, CAMERA_Y, CAMERA_Z], zoom: 88, near: 0.1, far: 70 }}
      shadows={{ type: THREE.VSMShadowMap }}
      dpr={[1, 1.7]}
    >
      <color attach="background" args={["#1f6d45"]} />
      <DicePhysicsScene
        dice={dice}
        rollRequest={rollRequest}
        onRollResolved={onRollResolved}
      />
    </Canvas>
  );
}

export default DiceTray3D;

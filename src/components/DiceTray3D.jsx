import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as CANNON from "cannon-es";
import * as THREE from "three";
import { getDieColor, selectAnimatedDiceIds } from "../lib/dice-visuals.js";

const DIE_SIZE = 0.68;
const TRAY_WIDTH = 9.6;
const TRAY_DEPTH = 6;
const WALL_HEIGHT = 1.15;
const WALL_THICKNESS = 0.18;

const hashCode = (value) => {
  const text = String(value ?? "");
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

const settledQuaternionFor = (id, face) => {
  const yaw = ((hashCode(id) + Number(face ?? 0) * 37) % 360) * (Math.PI / 180);
  const quaternion = new CANNON.Quaternion();
  quaternion.setFromEuler(0, yaw, 0);
  return quaternion;
};

const createLabelTexture = (face, dieType) => {
  if (!Number.isInteger(face)) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.fillStyle = "rgba(250, 248, 241, 0.96)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 8;
  context.strokeStyle = getDieColor(dieType);
  context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  context.fillStyle = "#1f2d30";
  context.font = "700 74px Avenir Next, Trebuchet MS, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(face), canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const layoutDiceTargets = (diceCount) => {
  if (diceCount <= 0) {
    return [];
  }

  const columns = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(diceCount * 1.6))));
  const rows = Math.ceil(diceCount / columns);
  const xSpacing = Math.min(1.12, (TRAY_WIDTH - 1.1) / Math.max(1, columns));
  const zSpacing = Math.min(1.05, (TRAY_DEPTH - 1.1) / Math.max(1, rows));
  const startX = -((columns - 1) * xSpacing) / 2;
  const startZ = -((rows - 1) * zSpacing) / 2;
  const targets = [];

  for (let index = 0; index < diceCount; index += 1) {
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

const DieFaceLabel = ({ face, dieType }) => {
  const texture = useMemo(() => createLabelTexture(face, dieType), [face, dieType]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture) {
    return null;
  }

  return (
    <sprite scale={[0.46, 0.46, 0.46]} position={[0, DIE_SIZE * 0.66, 0]}>
      <spriteMaterial map={texture} toneMapped={false} transparent depthWrite={false} />
    </sprite>
  );
};

const DicePhysicsScene = ({ dice, animatedIds, simulationKey }) => {
  const worldRef = useRef(null);
  const bodiesRef = useRef(new Map());
  const groupRefs = useRef(new Map());
  const stepAccumulatorRef = useRef(0);
  const staticBodiesRef = useRef([]);
  const dieShapeRef = useRef(new CANNON.Box(new CANNON.Vec3(DIE_SIZE / 2, DIE_SIZE / 2, DIE_SIZE / 2)));

  useEffect(() => {
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -24, 0),
      allowSleep: true,
    });
    world.defaultContactMaterial.friction = 0.32;
    world.defaultContactMaterial.restitution = 0.26;
    worldRef.current = world;

    const addStaticBox = (halfExtents, position) => {
      const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(halfExtents),
      });
      body.position.set(position.x, position.y, position.z);
      world.addBody(body);
      staticBodiesRef.current.push(body);
    };

    addStaticBox(
      new CANNON.Vec3(TRAY_WIDTH / 2, 0.2, TRAY_DEPTH / 2),
      { x: 0, y: -0.2, z: 0 },
    );
    addStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, TRAY_DEPTH / 2),
      { x: TRAY_WIDTH / 2 + WALL_THICKNESS / 2, y: WALL_HEIGHT / 2, z: 0 },
    );
    addStaticBox(
      new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, TRAY_DEPTH / 2),
      { x: -TRAY_WIDTH / 2 - WALL_THICKNESS / 2, y: WALL_HEIGHT / 2, z: 0 },
    );
    addStaticBox(
      new CANNON.Vec3(TRAY_WIDTH / 2 + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      { x: 0, y: WALL_HEIGHT / 2, z: TRAY_DEPTH / 2 + WALL_THICKNESS / 2 },
    );
    addStaticBox(
      new CANNON.Vec3(TRAY_WIDTH / 2 + WALL_THICKNESS, WALL_HEIGHT / 2, WALL_THICKNESS / 2),
      { x: 0, y: WALL_HEIGHT / 2, z: -TRAY_DEPTH / 2 - WALL_THICKNESS / 2 },
    );

    return () => {
      for (const body of bodiesRef.current.values()) {
        world.removeBody(body.body);
      }
      for (const body of staticBodiesRef.current) {
        world.removeBody(body);
      }
      bodiesRef.current.clear();
      groupRefs.current.clear();
      staticBodiesRef.current = [];
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const world = worldRef.current;

    if (!world) {
      return;
    }

    const diceList = Array.isArray(dice) ? dice : [];
    const animateSet = new Set(animatedIds);
    const existingIds = new Set(bodiesRef.current.keys());
    const nextIds = new Set();
    const targets = layoutDiceTargets(diceList.length);

    const snapBody = (body, target, id, face) => {
      body.type = CANNON.Body.KINEMATIC;
      body.mass = 0;
      body.updateMassProperties();
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.position.set(target.x, target.y, target.z);
      const quaternion = settledQuaternionFor(id, face);
      body.quaternion.copy(quaternion);
      body.sleep();
    };

    diceList.forEach((die, index) => {
      const id = String(die?.id ?? `die-${index + 1}`);
      const target = targets[index];
      nextIds.add(id);
      let bodyState = bodiesRef.current.get(id);

      if (!bodyState) {
        const body = new CANNON.Body({
          mass: 1,
          shape: dieShapeRef.current,
        });
        body.linearDamping = 0.4;
        body.angularDamping = 0.38;
        world.addBody(body);
        bodyState = {
          body,
          target,
          settleAt: 0,
          face: die?.face ?? null,
        };
        bodiesRef.current.set(id, bodyState);
      }

      bodyState.target = target;
      bodyState.face = die?.face ?? null;

      if (animateSet.has(id)) {
        const body = bodyState.body;
        body.type = CANNON.Body.DYNAMIC;
        body.mass = 1;
        body.updateMassProperties();
        body.position.set(
          (Math.random() - 0.5) * 3.2,
          1.9 + Math.random() * 0.7,
          (Math.random() - 0.5) * 1.9,
        );
        body.velocity.set(
          (Math.random() - 0.5) * 6.2,
          2 + Math.random() * 2.8,
          (Math.random() - 0.5) * 6.2,
        );
        body.angularVelocity.set(
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.5) * 18,
        );
        body.wakeUp();
        bodyState.settleAt = performance.now() + 900 + Math.random() * 240;
      } else {
        snapBody(bodyState.body, target, id, die?.face ?? null);
        bodyState.settleAt = 0;
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
  }, [dice, animatedIds, simulationKey]);

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

    const now = performance.now();

    for (const [id, bodyState] of bodiesRef.current) {
      const { body, target, settleAt, face } = bodyState;

      if (body.type === CANNON.Body.DYNAMIC && settleAt > 0 && now >= settleAt) {
        body.type = CANNON.Body.KINEMATIC;
        body.mass = 0;
        body.updateMassProperties();
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.position.set(target.x, target.y, target.z);
        body.quaternion.copy(settledQuaternionFor(id, face));
        body.sleep();
        bodyState.settleAt = 0;
      }

      const group = groupRefs.current.get(id);

      if (!group) {
        continue;
      }

      group.position.set(body.position.x, body.position.y, body.position.z);
      group.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      );
    }
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4.5, 8.4, 5]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRAY_WIDTH, TRAY_DEPTH]} />
        <meshStandardMaterial color="#dce9dc" roughness={0.94} metalness={0.01} />
      </mesh>

      <mesh position={[TRAY_WIDTH / 2 + WALL_THICKNESS / 2, WALL_HEIGHT / 2 - 0.02, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, TRAY_DEPTH + WALL_THICKNESS]} />
        <meshStandardMaterial color="#90a78f" roughness={0.88} />
      </mesh>
      <mesh position={[-TRAY_WIDTH / 2 - WALL_THICKNESS / 2, WALL_HEIGHT / 2 - 0.02, 0]}>
        <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, TRAY_DEPTH + WALL_THICKNESS]} />
        <meshStandardMaterial color="#90a78f" roughness={0.88} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2 - 0.02, TRAY_DEPTH / 2 + WALL_THICKNESS / 2]}>
        <boxGeometry args={[TRAY_WIDTH + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#90a78f" roughness={0.88} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT / 2 - 0.02, -TRAY_DEPTH / 2 - WALL_THICKNESS / 2]}>
        <boxGeometry args={[TRAY_WIDTH + WALL_THICKNESS * 2, WALL_HEIGHT, WALL_THICKNESS]} />
        <meshStandardMaterial color="#90a78f" roughness={0.88} />
      </mesh>

      {dice.map((die, index) => {
        const id = String(die?.id ?? `die-${index + 1}`);

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
            <mesh castShadow receiveShadow>
              <boxGeometry args={[DIE_SIZE, DIE_SIZE, DIE_SIZE]} />
              <meshStandardMaterial
                color={getDieColor(die?.type)}
                roughness={0.38}
                metalness={0.08}
              />
            </mesh>
            <DieFaceLabel face={die?.face} dieType={die?.type} />
          </group>
        );
      })}
    </>
  );
};

function DiceTray3D({ roll }) {
  const dice = Array.isArray(roll?.dice) ? roll.dice : [];
  const animatedIds = useMemo(() => selectAnimatedDiceIds(roll), [roll]);
  const simulationKey = Number.isFinite(roll?.rolledAt) ? roll.rolledAt : 0;

  return (
    <Canvas
      camera={{ position: [0, 7, 6.6], fov: 34, near: 0.1, far: 50 }}
      shadows
      dpr={[1, 1.7]}
    >
      <color attach="background" args={["#ebf2e9"]} />
      <DicePhysicsScene dice={dice} animatedIds={animatedIds} simulationKey={simulationKey} />
    </Canvas>
  );
}

export default DiceTray3D;

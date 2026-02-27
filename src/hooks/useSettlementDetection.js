import { useCallback } from "react";
import { DICE_TYPE } from "../lib/dice.js";
import {
  clampBodyInside,
  freezeBodyInPlace,
  nudgeEdgeLeaningDie,
} from "../lib/physics.js";
import { topFaceFromQuaternion } from "../lib/face-mapping.js";

export const useSettlementDetection = ({
  bodiesRef,
  boundsRef,
  pendingSimulationRef,
  settleFramesRef,
  onRollResolvedRef,
  minSettleMs,
  maxSettleMs,
  settleLinearSpeed,
  settleAngularSpeed,
  settleFramesTarget,
  settleFaceAlignment,
  edgeNudgeCooldownMs,
  edgeNudgeMaxAttempts,
}) =>
  useCallback(() => {
    const pending = pendingSimulationRef.current;

    if (!pending || pending.reported) {
      return;
    }

    const now = performance.now();
    const elapsed = now - pending.startedAt;
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
        linearSpeedSq > settleLinearSpeed * settleLinearSpeed ||
        angularSpeedSq > settleAngularSpeed * settleAngularSpeed
      ) {
        isMoving = true;
        break;
      }

      if (alignment < settleFaceAlignment) {
        hasEdgeLeaningDie = true;
        edgeLeaningBodies.push(bodyState.body);
      }
    }

    if (isMoving) {
      settleFramesRef.current = 0;
    } else {
      settleFramesRef.current += 1;
    }

    let allSettled =
      elapsed >= minSettleMs &&
      settleFramesRef.current >= settleFramesTarget &&
      !hasEdgeLeaningDie;

    if (
      hasEdgeLeaningDie &&
      !isMoving &&
      pending.nudgeAttempts < edgeNudgeMaxAttempts &&
      elapsed >= minSettleMs &&
      now - pending.lastNudgeAt >= edgeNudgeCooldownMs
    ) {
      for (const body of edgeLeaningBodies) {
        nudgeEdgeLeaningDie(body);
      }
      pending.lastNudgeAt = now;
      pending.nudgeAttempts += 1;
      settleFramesRef.current = 0;
      allSettled = false;
    } else if (
      elapsed >= maxSettleMs &&
      hasEdgeLeaningDie &&
      pending.nudgeAttempts >= edgeNudgeMaxAttempts
    ) {
      allSettled = true;
    } else if (elapsed >= maxSettleMs && !hasEdgeLeaningDie) {
      allSettled = true;
    }

    if (!allSettled) {
      return;
    }

    const resolvedDice = pending.order.map((id) => {
      const bodyState = bodiesRef.current.get(id);
      const resolvedFace = bodyState
        ? topFaceFromQuaternion(bodyState.body.quaternion)
        : null;
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
  }, [
    bodiesRef,
    boundsRef,
    edgeNudgeCooldownMs,
    edgeNudgeMaxAttempts,
    maxSettleMs,
    minSettleMs,
    onRollResolvedRef,
    pendingSimulationRef,
    settleAngularSpeed,
    settleFaceAlignment,
    settleFramesRef,
    settleFramesTarget,
    settleLinearSpeed,
  ]);

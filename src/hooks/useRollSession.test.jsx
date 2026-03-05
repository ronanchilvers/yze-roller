// @vitest-environment jsdom
import { useEffect } from "react";
import PropTypes from "prop-types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { useRollSession } from "./useRollSession.js";

const createContainer = () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    root,
    render(node) {
      act(() => {
        root.render(node);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const CaptureRollSession = ({ onCapture, onBaneIncrement = vi.fn() }) => {
  const session = useRollSession({
    attributeDice: 2,
    skillDice: 1,
    rollModifier: 0,
    normalizedStrainPoints: 0,
    onBaneIncrement,
  });

  useEffect(() => {
    onCapture(session);
  }, [onCapture, session]);

  return null;
};

CaptureRollSession.propTypes = {
  onBaneIncrement: PropTypes.func,
  onCapture: PropTypes.func.isRequired,
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

test("completed rolls add roll type labels to history entries", () => {
  let captured;
  const app = createContainer();

  app.render(
    <CaptureRollSession
      onCapture={(session) => {
        captured = session;
      }}
    />,
  );

  act(() => {
    captured.onRoll({ rollTypeLabel: "Sneak (Agility)" });
  });

  const requestKey = captured.rollRequest?.key;
  expect(requestKey).toBeDefined();

  act(() => {
    captured.onRollResolved({
      key: requestKey,
      action: "roll",
      rolledAt: 100,
      dice: [
        { id: "attribute-1", type: "attribute", face: 6 },
        { id: "skill-1", type: "skill", face: 2 },
      ],
    });
  });

  expect(captured.currentRoll?.rollTypeLabel).toBe("Sneak (Agility)");
  expect(captured.recentResults[0]?.summary).toBe(
    "Roll result - Sneak (Agility) - 1 successes, 0 banes",
  );

  app.unmount();
});

test("push history entries keep the original roll type label", () => {
  let captured;
  const app = createContainer();

  app.render(
    <CaptureRollSession
      onCapture={(session) => {
        captured = session;
      }}
    />,
  );

  act(() => {
    captured.onRoll({ rollTypeLabel: "Hoodwink (Empathy)" });
  });

  const initialRequestKey = captured.rollRequest?.key;
  expect(initialRequestKey).toBeDefined();

  act(() => {
    captured.onRollResolved({
      key: initialRequestKey,
      action: "roll",
      rolledAt: 200,
      dice: [
        { id: "attribute-1", type: "attribute", face: 6 },
        { id: "skill-1", type: "skill", face: 2 },
      ],
    });
  });

  act(() => {
    captured.onPush();
  });

  const pushRequestKey = captured.rollRequest?.key;
  expect(pushRequestKey).toBeDefined();

  act(() => {
    captured.onRollResolved({
      key: pushRequestKey,
      action: "push",
      rolledAt: 201,
      dice: [
        { id: "attribute-1", type: "attribute", face: 6 },
        { id: "skill-1", type: "skill", face: 1 },
      ],
    });
  });

  expect(captured.currentRoll?.rollTypeLabel).toBe("Hoodwink (Empathy)");
  expect(captured.recentResults[0]?.summary).toBe(
    "Push result - Hoodwink (Empathy) - 1 successes, 1 banes",
  );

  app.unmount();
});

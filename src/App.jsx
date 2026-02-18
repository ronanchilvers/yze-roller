import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { usePoolSelection } from "./hooks/usePoolSelection.js";
import { useStrainTracker } from "./hooks/useStrainTracker.js";
import { useRollSession } from "./hooks/useRollSession.js";
import { useCharacterImport } from "./hooks/useCharacterImport.js";
import { useThemePreference } from "./hooks/useThemePreference.js";
import { useToast } from "./hooks/useToast.js";
import {
  DEFAULT_DICE_RESULT_DURATION_MS,
  MAX_PENDING_TOASTS,
} from "./components/toast/constants.js";
import {
  buildRollToastPayload,
  getRollToastDedupKey,
  ROLL_TOAST_DEDUPE_BUCKET_MS,
  normalizeRollToastEvent,
} from "./lib/roll-toast-event.js";
import DicePoolPanel from "./components/DicePoolPanel.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

export const REMOTE_ROLL_EVENT_BRIDGE_KEY = "__YEAR_ZERO_REMOTE_ROLL_EVENT__";
const DEDUPE_TTL_MS = ROLL_TOAST_DEDUPE_BUCKET_MS * 2;
const DiceTray3D = lazy(() => import("./components/DiceTray3D.jsx"));

function App() {
  const {
    attributeDice,
    skillDice,
    setAttributeDice,
    setSkillDice,
  } = usePoolSelection();
  const toast = useToast();
  const { themePreference, resolvedTheme, setThemePreference } =
    useThemePreference();

  const { normalizedStrainPoints, onResetStrain, applyBaneIncrement } =
    useStrainTracker();

  const characterImport = useCharacterImport();
  const {
    importFromFile,
    reset: resetImport,
    setSelectedAttribute,
    setSelectedSkill,
  } = characterImport;

  const [overrideCounts, setOverrideCounts] = useState(null);
  const [pendingRollCounts, setPendingRollCounts] = useState(null);

  const effectiveAttributeDice = overrideCounts?.attributeDice ?? attributeDice;
  const effectiveSkillDice = overrideCounts?.skillDice ?? skillDice;

  const {
    currentRoll,
    rollRequest,
    recentResults,
    isRolling,
    canPush,
    onRoll,
    onPush,
    onClearDice,
    onRollResolved,
  } = useRollSession({
    attributeDice: effectiveAttributeDice,
    skillDice: effectiveSkillDice,
    normalizedStrainPoints,
    onBaneIncrement: applyBaneIncrement,
  });
  const activeDice = rollRequest?.dice ?? currentRoll?.dice ?? [];
  const pushableDiceCount = Number(currentRoll?.pushableDiceIds?.length ?? 0);
  const canClearDice =
    isRolling || activeDice.length > 0 || recentResults.length > 0;
  const hasRolled = Boolean(currentRoll);
  const primaryActionLabel = "Roll Dice";
  const isPrimaryActionDisabled = isRolling;

  const emittedToastKeysRef = useRef(new Map());

  const emitRollToastEvent = useCallback(
    (eventInput) => {
      const normalizedEvent = normalizeRollToastEvent(eventInput);
      const dedupeKey = getRollToastDedupKey(normalizedEvent);
      const now = Date.now();
      const cutoff = now - DEDUPE_TTL_MS;
      const emittedMap = emittedToastKeysRef.current;

      for (const [key, emittedAt] of emittedMap.entries()) {
        if (!Number.isFinite(emittedAt) || emittedAt < cutoff) {
          emittedMap.delete(key);
        }
      }

      if (emittedMap.has(dedupeKey)) {
        return;
      }

      const toastPayload = buildRollToastPayload(normalizedEvent);

      if (typeof toast.diceResult !== "function") {
        return;
      }

      toast.diceResult({
        title: toastPayload.title,
        message: toastPayload.message,
        duration: DEFAULT_DICE_RESULT_DURATION_MS,
      });
      emittedMap.set(dedupeKey, now);
      while (emittedMap.size > MAX_PENDING_TOASTS) {
        const oldestKey = emittedMap.keys().next().value;
        if (!oldestKey) {
          break;
        }
        emittedMap.delete(oldestKey);
      }
    },
    [toast],
  );

  const onPrimaryAction = () => {
    onRoll();
  };

  const handleRollWithCounts = (counts) => {
    if (!counts) {
      return;
    }

    setOverrideCounts(counts);
    setPendingRollCounts(counts);
  };

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (!pendingRollCounts || isRolling) {
      return;
    }

    onRoll();
    setPendingRollCounts(null);
    setOverrideCounts(null);
  }, [pendingRollCounts, isRolling, onRoll]);

  useEffect(() => {
    if (!currentRoll) {
      return;
    }

    const localToastKey =
      recentResults[0]?.id ??
      (Number.isFinite(currentRoll?.rolledAt)
        ? `local-${currentRoll.rolledAt}`
        : null);
    if (!localToastKey) {
      return;
    }

    emitRollToastEvent({
      eventId: localToastKey,
      source: "local",
      action: currentRoll?.action,
      successes: currentRoll?.outcomes?.successes,
      banes: currentRoll?.outcomes?.banes,
      hasStrain: currentRoll?.outcomes?.hasStrain,
      occurredAt: currentRoll?.rolledAt,
    });
  }, [currentRoll, emitRollToastEvent, recentResults]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const bridgeHandler = (eventPayload) => {
      emitRollToastEvent({
        ...eventPayload,
        source: "remote",
      });
    };

    window[REMOTE_ROLL_EVENT_BRIDGE_KEY] = bridgeHandler;

    return () => {
      if (window[REMOTE_ROLL_EVENT_BRIDGE_KEY] === bridgeHandler) {
        delete window[REMOTE_ROLL_EVENT_BRIDGE_KEY];
      }
    };
  }, [emitRollToastEvent]);

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="dice-stage-fullscreen" aria-hidden="true">
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="tray-loading">
                <span className="tray-spinner" aria-hidden="true" />
                Loading 3D tray…
              </div>
            }
          >
            <DiceTray3D
              dice={activeDice}
              rollRequest={rollRequest}
              onRollResolved={onRollResolved}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
      <section
        id="main-content"
        className="dice-layout"
        aria-label="Year Zero dice roller"
      >
        <header className="top-bar">
          <div>
            <p className="eyebrow">Year Zero Engine</p>
            <h1>Dice Roller</h1>
          </div>
          <div className="top-bar-actions">
            <label className="theme-select" htmlFor="themePreference">
              <span>Theme</span>
              <select
                id="themePreference"
                name="themePreference"
                value={themePreference}
                onChange={(event) => setThemePreference(event.target.value)}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <output className="strain-pill" aria-label="Current strain points">
              <div className="strain-pill-head">
                <span>Strain Points</span>
                <button
                  type="button"
                  className="strain-reset-button"
                  aria-label="Reset strain points"
                  onClick={onResetStrain}
                  disabled={normalizedStrainPoints === 0}
                >
                  ↺
                </button>
              </div>
              <strong>{normalizedStrainPoints}</strong>
            </output>
          </div>
        </header>

        <div className="content-grid">
          <DicePoolPanel
            attributeDice={attributeDice}
            skillDice={skillDice}
            onPrimaryAction={onPrimaryAction}
            primaryActionLabel={primaryActionLabel}
            isPrimaryActionDisabled={isPrimaryActionDisabled}
            isRolling={isRolling}
            setAttributeDice={setAttributeDice}
            setSkillDice={setSkillDice}
            onRoll={onRoll}
            onRollWithCounts={handleRollWithCounts}
            importState={characterImport}
            onImportFile={importFromFile}
            onResetImport={resetImport}
            onSelectAttribute={setSelectedAttribute}
            onSelectSkill={setSelectedSkill}
            onPush={onPush}
            pushActionLabel={`Push ${pushableDiceCount} Dice`}
            isPushDisabled={isRolling || !hasRolled || !canPush}
            onClearDice={onClearDice}
            isClearDisabled={!canClearDice}
          />
        </div>
      </section>
    </main>
  );
}

export default App;

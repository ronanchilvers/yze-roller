import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import "./App.css";
import { usePoolSelection } from "./hooks/usePoolSelection.js";
import { useStrainTracker } from "./hooks/useStrainTracker.js";
import { useRollSession } from "./hooks/useRollSession.js";
import { useCharacterImport } from "./hooks/useCharacterImport.js";
import { useThemePreference } from "./hooks/useThemePreference.js";
import { useToast } from "./hooks/useToast.js";
import { useMultiplayerSession } from "./hooks/useMultiplayerSession.js";
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
import {
  buildJoinPathWithToken,
  clearLocationHash,
  getSessionPathFromJoinPath,
  isJoinSessionPath,
  parseJoinTokenFromHash,
} from "./lib/join-session-route.js";
import {
  getSessionAuth,
  setSessionAuth,
} from "./lib/session-auth.js";
import DicePoolPanel from "./components/DicePoolPanel.jsx";
import HostSessionView from "./components/HostSessionView.jsx";
import JoinSessionView from "./components/JoinSessionView.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

export const REMOTE_ROLL_EVENT_BRIDGE_KEY = "__YEAR_ZERO_REMOTE_ROLL_EVENT__";
const DEDUPE_TTL_MS = ROLL_TOAST_DEDUPE_BUCKET_MS * 2;
const MAX_SUBMITTED_SESSION_ACTIONS = 100;
const DiceTray3D = lazy(() => import("./components/DiceTray3D.jsx"));

const getBrowserPathname = () => {
  if (typeof window === "undefined") {
    return "/";
  }

  return window.location.pathname || "/";
};

const getBrowserHash = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.hash || "";
};

const normalizeOutcomeCount = (value) => {
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 99) {
    return null;
  }

  return numeric;
};

const buildSessionActionRequest = (roll) => {
  if (!roll || typeof roll !== "object") {
    return null;
  }

  const successes = normalizeOutcomeCount(roll?.outcomes?.successes);
  const banes = normalizeOutcomeCount(roll?.outcomes?.banes);

  if (successes === null || banes === null) {
    return null;
  }

  if (roll.action === "push") {
    return {
      action: "push",
      payload: {
        successes,
        banes,
        strain: Boolean(roll?.outcomes?.hasStrain),
      },
    };
  }

  return {
    action: "roll",
    payload: {
      successes,
      banes,
    },
  };
};

const getCurrentRollActionId = (currentRoll, recentResults) => {
  if (!currentRoll) {
    return null;
  }

  if (typeof recentResults?.[0]?.id === "string" && recentResults[0].id.trim()) {
    return recentResults[0].id.trim();
  }

  if (Number.isFinite(currentRoll.rolledAt)) {
    return `${currentRoll.action ?? "roll"}-${currentRoll.rolledAt}`;
  }

  return null;
};

const normalizeActionErrorMessage = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

function DiceRollerApp({
  sessionSummary = null,
  sessionActions = null,
}) {
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
  const [isActionSubmitPending, setIsActionSubmitPending] = useState(false);
  const [sessionActionError, setSessionActionError] = useState("");

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
  const isPrimaryActionDisabled = isRolling || isActionSubmitPending;

  const emittedToastKeysRef = useRef(new Map());
  const submittedSessionActionsRef = useRef(new Map());
  const isMountedRef = useRef(true);
  const submitRollAction = sessionActions?.submitRoll;
  const submitPushAction = sessionActions?.submitPush;

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    const actionRequest = buildSessionActionRequest(currentRoll);
    const actionId = getCurrentRollActionId(currentRoll, recentResults);

    if (!actionRequest || !actionId) {
      return;
    }

    const submitAction =
      actionRequest.action === "push" ? submitPushAction : submitRollAction;

    if (typeof submitAction !== "function") {
      return;
    }

    const submittedMap = submittedSessionActionsRef.current;
    if (submittedMap.has(actionId)) {
      return;
    }

    submittedMap.set(actionId, Date.now());
    while (submittedMap.size > MAX_SUBMITTED_SESSION_ACTIONS) {
      const oldestKey = submittedMap.keys().next().value;
      if (!oldestKey) {
        break;
      }
      submittedMap.delete(oldestKey);
    }

    const syncAction = async () => {
      setIsActionSubmitPending(true);
      setSessionActionError("");

      try {
        const result = await submitAction(actionRequest.payload);

        if (!isMountedRef.current) {
          return;
        }

        if (!result?.ok) {
          setSessionActionError(
            normalizeActionErrorMessage(result?.errorMessage) ||
              "Unable to sync action with multiplayer session.",
          );
          return;
        }

        setSessionActionError("");
      } catch {
        if (!isMountedRef.current) {
          return;
        }

        setSessionActionError("Unable to sync action with multiplayer session.");
      } finally {
        if (isMountedRef.current) {
          setIsActionSubmitPending(false);
        }
      }
    };

    void syncAction();
  }, [currentRoll, recentResults, submitPushAction, submitRollAction]);

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

        {sessionSummary ? (
          <section
            className="panel session-summary-panel"
            aria-label="Multiplayer session status"
            data-testid="session-summary"
          >
            <div className="session-summary-head">
              <p className="eyebrow">Multiplayer Session</p>
              <span
                className={`session-connection-badge is-${sessionSummary.connectionTone}`}
              >
                {sessionSummary.connectionStatus}
              </span>
            </div>
            <div className="session-summary-grid">
              <p className="session-summary-item">
                <span>Role</span>
                <strong>{sessionSummary.roleLabel}</strong>
              </p>
              <p className="session-summary-item">
                <span>Session</span>
                <strong>{sessionSummary.sessionName}</strong>
              </p>
              <p className="session-summary-item">
                <span>Scene Strain</span>
                <strong>{sessionSummary.sceneStrain}</strong>
              </p>
              <p className="session-summary-item">
                <span>Players</span>
                <strong>{sessionSummary.playerCount}</strong>
              </p>
            </div>
            {sessionActionError ? (
              <p
                className="panel-copy session-action-error"
                role="alert"
                data-testid="session-action-error"
              >
                {sessionActionError}
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="content-grid">
          <DicePoolPanel
            attributeDice={attributeDice}
            skillDice={skillDice}
            onPrimaryAction={onPrimaryAction}
            primaryActionLabel={primaryActionLabel}
            isPrimaryActionDisabled={isPrimaryActionDisabled}
            isRolling={isRolling}
            isActionSubmitPending={isActionSubmitPending}
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
            isPushDisabled={isRolling || !hasRolled || !canPush || isActionSubmitPending}
            onClearDice={onClearDice}
            isClearDisabled={!canClearDice}
          />
        </div>
      </section>
    </main>
  );
}

DiceRollerApp.propTypes = {
  sessionSummary: PropTypes.shape({
    connectionStatus: PropTypes.string.isRequired,
    connectionTone: PropTypes.oneOf(["online", "pending", "error"]).isRequired,
    roleLabel: PropTypes.string.isRequired,
    sessionName: PropTypes.string.isRequired,
    sceneStrain: PropTypes.number.isRequired,
    playerCount: PropTypes.number.isRequired,
  }),
  sessionActions: PropTypes.shape({
    submitRoll: PropTypes.func,
    submitPush: PropTypes.func,
  }),
};

const resolveMultiplayerMode = ({
  isJoinRoute,
  sessionStatus,
  hasSessionToken,
}) => {
  if (isJoinRoute) {
    return "join";
  }

  if (sessionStatus === "auth_lost") {
    return "auth_lost";
  }

  if (hasSessionToken) {
    return "session";
  }

  return "host";
};

function MultiplayerAuthLostView({ onReset }) {
  return (
    <main className="app-shell join-shell" data-mode="auth_lost">
      <section className="panel join-panel" aria-label="Session ended">
        <header className="join-header">
          <p className="eyebrow">Multiplayer</p>
          <h1>Session Ended</h1>
        </header>
        <p className="panel-copy">
          Your session token is no longer valid. Rejoin with a current invite link.
        </p>
        <button type="button" className="pool-action-button" onClick={onReset}>
          Return to host/join
        </button>
      </section>
    </main>
  );
}

MultiplayerAuthLostView.propTypes = {
  onReset: PropTypes.func.isRequired,
};

const normalizeSessionText = (value, fallback) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmedValue = value.trim();
  return trimmedValue || fallback;
};

const normalizeSessionCount = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.floor(numeric);
};

const buildConnectionSummary = (sessionState) => {
  if (sessionState?.status === "error" || sessionState?.status === "auth_lost") {
    return {
      label: "Connection Error",
      tone: "error",
    };
  }

  if (sessionState?.status === "loading") {
    return {
      label: "Connecting",
      tone: "pending",
    };
  }

  if (sessionState?.pollingStatus === "backoff") {
    return {
      label: "Reconnecting",
      tone: "pending",
    };
  }

  if (sessionState?.pollingStatus === "running" || sessionState?.status === "ready") {
    return {
      label: "Connected",
      tone: "online",
    };
  }

  return {
    label: "Initializing",
    tone: "pending",
  };
};

function SessionView({
  hasSessionToken,
  sessionState,
  bootstrapFromAuth,
  submitRoll,
  submitPush,
}) {
  useEffect(() => {
    if (!hasSessionToken || sessionState?.status !== "idle") {
      return;
    }

    void bootstrapFromAuth();
  }, [bootstrapFromAuth, hasSessionToken, sessionState?.status]);

  const connectionSummary = buildConnectionSummary(sessionState);
  const roleLabel =
    sessionState?.role === "gm"
      ? "GM"
      : sessionState?.role === "player"
        ? "Player"
        : "Unknown";
  const sessionName = normalizeSessionText(
    sessionState?.sessionName,
    normalizeSessionCount(sessionState?.sessionId) > 0
      ? `Session ${normalizeSessionCount(sessionState?.sessionId)}`
      : "Session",
  );
  const sceneStrain = normalizeSessionCount(sessionState?.sceneStrain);
  const playerCount = Array.isArray(sessionState?.players)
    ? sessionState.players.length
    : 0;
  const resolvedSessionActions = useMemo(() => {
    if (typeof submitRoll !== "function" && typeof submitPush !== "function") {
      return null;
    }

    return {
      submitRoll,
      submitPush,
    };
  }, [submitPush, submitRoll]);

  return (
    <DiceRollerApp
      sessionSummary={{
        connectionStatus: connectionSummary.label,
        connectionTone: connectionSummary.tone,
        roleLabel,
        sessionName,
        sceneStrain,
        playerCount,
      }}
      sessionActions={resolvedSessionActions}
    />
  );
}

SessionView.propTypes = {
  hasSessionToken: PropTypes.bool.isRequired,
  sessionState: PropTypes.shape({
    status: PropTypes.string,
    pollingStatus: PropTypes.string,
    role: PropTypes.string,
    sessionId: PropTypes.number,
    sessionName: PropTypes.string,
    sceneStrain: PropTypes.number,
    players: PropTypes.arrayOf(PropTypes.object),
  }),
  bootstrapFromAuth: PropTypes.func.isRequired,
  submitRoll: PropTypes.func,
  submitPush: PropTypes.func,
};

function App() {
  const [pathname, setPathname] = useState(getBrowserPathname);
  const [hash, setHash] = useState(getBrowserHash);
  const [authVersion, setAuthVersion] = useState(0);
  const isJoinRoute = isJoinSessionPath(pathname);
  const joinToken = parseJoinTokenFromHash(hash);
  const {
    sessionState,
    bootstrapFromAuth,
    submitRoll,
    submitPush,
    resetSession,
  } = useMultiplayerSession();
  const sessionAuth = useMemo(() => getSessionAuth(), [authVersion]);
  const hasSessionToken = Boolean(sessionAuth?.sessionToken?.trim());
  const mode = resolveMultiplayerMode({
    isJoinRoute,
    sessionStatus: sessionState?.status,
    hasSessionToken,
  });

  const syncLocation = useCallback(() => {
    setPathname(getBrowserPathname());
    setHash(getBrowserHash());
  }, []);

  const navigateToPath = useCallback(
    (nextPath) => {
      if (typeof window === "undefined") {
        return;
      }

      window.history.pushState({}, "", nextPath);
      syncLocation();
    },
    [syncLocation],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    window.addEventListener("popstate", syncLocation);
    window.addEventListener("hashchange", syncLocation);

    return () => {
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener("hashchange", syncLocation);
    };
  }, [syncLocation]);

  const exitJoinRoute = useCallback(() => {
    clearLocationHash(window);
    navigateToPath(getSessionPathFromJoinPath(pathname));
  }, [navigateToPath, pathname]);

  const handleJoinSuccess = useCallback(
    (authState) => {
      setSessionAuth(authState);
      setAuthVersion((current) => current + 1);
      clearLocationHash(window);
      navigateToPath(getSessionPathFromJoinPath(pathname));
    },
    [navigateToPath, pathname],
  );

  const handleHostSuccess = useCallback((authState) => {
    setSessionAuth(authState);
    setAuthVersion((current) => current + 1);
  }, []);

  const handleResetAfterAuthLost = useCallback(() => {
    resetSession();
    setAuthVersion((current) => current + 1);
    clearLocationHash(window);
    navigateToPath(getSessionPathFromJoinPath(pathname));
  }, [navigateToPath, pathname, resetSession]);

  const handleUseInviteLink = useCallback(
    (resolvedJoinToken) => {
      const nextPath = buildJoinPathWithToken(pathname, resolvedJoinToken);

      if (!nextPath) {
        return;
      }

      navigateToPath(nextPath);
    },
    [navigateToPath, pathname],
  );

  if (mode === "join") {
    return (
      <JoinSessionView
        joinToken={joinToken}
        onJoinSuccess={handleJoinSuccess}
        onExitJoin={exitJoinRoute}
        onUseInviteLink={handleUseInviteLink}
      />
    );
  }

  if (mode === "auth_lost") {
    return <MultiplayerAuthLostView onReset={handleResetAfterAuthLost} />;
  }

  if (mode === "host") {
    return (
      <HostSessionView
        onHostSuccess={handleHostSuccess}
        onUseInviteLink={handleUseInviteLink}
      />
    );
  }

  return (
    <SessionView
      hasSessionToken={hasSessionToken}
      sessionState={sessionState}
      bootstrapFromAuth={bootstrapFromAuth}
      submitRoll={submitRoll}
      submitPush={submitPush}
    />
  );
}

export default App;

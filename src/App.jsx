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
import { RotateCcw } from "lucide-react";
import "./App.css";
import { usePoolSelection } from "./hooks/usePoolSelection.js";
import { useStrainTracker } from "./hooks/useStrainTracker.js";
import { useRollSession } from "./hooks/useRollSession.js";
import { useCharacterImport } from "./hooks/useCharacterImport.js";
import { useThemePreference } from "./hooks/useThemePreference.js";
import { useMultiplayerSession } from "./hooks/useMultiplayerSession.js";
import { useSessionActionSubmit } from "./hooks/useSessionActionSubmit.js";
import {
  REMOTE_ROLL_EVENT_BRIDGE_KEY,
  useRemoteRollToasts,
} from "./hooks/useRemoteRollToasts.js";
import { useGmActions } from "./hooks/useGmActions.js";
import {
  normalizeSessionCount,
  normalizeSessionEventsForFeed,
  normalizeSessionPlayerDisplayName,
  normalizeSessionPlayerTokenId,
  normalizeSessionPlayersForGmPanel,
  normalizeSessionText,
} from "./lib/session-event-normalize.js";
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
import GmControlsPanel from "./components/GmControlsPanel.jsx";
import HostSessionView from "./components/HostSessionView.jsx";
import JoinSessionView from "./components/JoinSessionView.jsx";
import MultiplayerAuthLostView from "./components/MultiplayerAuthLostView.jsx";
import SessionView from "./components/SessionView.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import LucideIcon from "./components/LucideIcon.jsx";

export { REMOTE_ROLL_EVENT_BRIDGE_KEY };
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

function DiceRollerApp({
  sessionSummary = null,
  sessionActions = null,
  sessionEvents = [],
  gmControls = null,
  sessionConnectionMeta = null,
}) {
  const {
    attributeDice,
    skillDice,
    setAttributeDice,
    setSkillDice,
  } = usePoolSelection();
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
  const [isRetryPending, setIsRetryPending] = useState(false);
  const [rollModifier, setRollModifier] = useState(0);
  const visibleSessionEvents = useMemo(
    () => normalizeSessionEventsForFeed(sessionEvents),
    [sessionEvents],
  );
  const gmPlayers = useMemo(
    () => normalizeSessionPlayersForGmPanel(gmControls?.players),
    [gmControls?.players],
  );
  const {
    gmActionError,
    gmActionMessage,
    gmPendingAction,
    rotatedJoinLink,
    handleRotateJoinLink,
    handleToggleJoining,
    handleResetSceneStrain,
    handleRefreshPlayers,
    handleRevokePlayer,
    handleCopyJoinLink,
  } = useGmActions({ gmControls });

  const effectiveAttributeDice = overrideCounts?.attributeDice ?? attributeDice;
  const effectiveSkillDice = overrideCounts?.skillDice ?? skillDice;
  const shouldUseAuthoritativeSessionStrain =
    Boolean(sessionSummary) && Number.isFinite(sessionSummary?.sceneStrain);
  const resolvedStrainPoints = shouldUseAuthoritativeSessionStrain
    ? normalizeSessionCount(sessionSummary?.sceneStrain)
    : normalizedStrainPoints;
  const canResetStrainLocally = !shouldUseAuthoritativeSessionStrain;
  const canResetStrainAsGm =
    shouldUseAuthoritativeSessionStrain &&
    Boolean(gmControls?.resetSceneStrain) &&
    !gmPendingAction;
  const shouldShowTopBarStrainReset =
    canResetStrainLocally ||
    (shouldUseAuthoritativeSessionStrain && Boolean(gmControls?.resetSceneStrain));
  const canResetStrain =
    resolvedStrainPoints > 0 && (canResetStrainLocally || canResetStrainAsGm);
  const ignoreBaneIncrement = useCallback(() => {}, []);
  const resolvedSessionName = normalizeSessionText(sessionSummary?.sessionName, "Dice Roller");
  const resolvedRoleLabel = normalizeSessionText(sessionSummary?.roleLabel, "Unknown");
  const sessionSelfTokenId = normalizeSessionPlayerTokenId(sessionSummary?.selfTokenId);
  const sessionSelfDisplayName = normalizeSessionPlayerDisplayName(
    sessionSummary?.selfDisplayName,
  );
  const rolePillTone =
    resolvedRoleLabel === "GM"
      ? "gm"
      : resolvedRoleLabel === "Player"
        ? "player"
        : "unknown";

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
    rollModifier,
    normalizedStrainPoints: resolvedStrainPoints,
    onBaneIncrement: shouldUseAuthoritativeSessionStrain
      ? ignoreBaneIncrement
      : applyBaneIncrement,
  });
  const activeDice = rollRequest?.dice ?? currentRoll?.dice ?? [];
  const pushableDiceCount = Number(currentRoll?.pushableDiceIds?.length ?? 0);
  const canClearDice =
    isRolling || activeDice.length > 0 || recentResults.length > 0;
  const hasRolled = Boolean(currentRoll);
  const primaryActionLabel = "Roll Dice";
  const submitRollAction = sessionActions?.submitRoll;
  const submitPushAction = sessionActions?.submitPush;
  const {
    isActionSubmitPending,
    sessionActionError,
    suppressedSessionRollEventIdsRef,
  } = useSessionActionSubmit({
    currentRoll,
    recentResults,
    submitRoll: submitRollAction,
    submitPush: submitPushAction,
  });
  const { emitRollToastEvent } = useRemoteRollToasts({
    sessionEvents,
    sessionSelfTokenId,
    sessionSelfDisplayName,
    sessionId: sessionSummary?.sessionId,
    suppressedSessionRollEventIdsRef,
  });
  const isPrimaryActionDisabled = isRolling || isActionSubmitPending;

  const isMountedRef = useRef(true);
  const retryPendingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  const handleClearDice = () => {
    setRollModifier(0);
    onClearDice();
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

  const handleTopBarStrainReset = useCallback(() => {
    if (canResetStrainLocally) {
      onResetStrain();
      return;
    }

    if (canResetStrainAsGm) {
      handleResetSceneStrain();
    }
  }, [
    canResetStrainAsGm,
    canResetStrainLocally,
    handleResetSceneStrain,
    onResetStrain,
  ]);


  const handleRetryConnection = useCallback(() => {
    const onRetry = sessionConnectionMeta?.onRetry;

    if (retryPendingRef.current || typeof onRetry !== "function") {
      return;
    }

    retryPendingRef.current = true;
    setIsRetryPending(true);

    const runRetry = async () => {
      try {
        await onRetry();
      } finally {
        retryPendingRef.current = false;
        if (isMountedRef.current) {
          setIsRetryPending(false);
        }
      }
    };

    void runRetry();
  }, [sessionConnectionMeta]);

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
          <div className="top-bar-title">
            <p className="eyebrow">Year Zero Engine</p>
            <div className="session-heading-row">
              {sessionSummary ? (
                <span
                  className={`session-connection-dot is-${sessionSummary.connectionTone}`}
                  data-testid="session-connection-dot"
                  aria-label={`Connection status: ${sessionSummary.connectionStatus}`}
                  title={sessionSummary.connectionStatus}
                />
              ) : null}
              <h1>{resolvedSessionName}</h1>
            </div>
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
            <div className="strain-status-group">
              {sessionSummary ? (
                <output
                  className={`role-pill role-pill-${rolePillTone}`}
                  aria-label={`Session role: ${resolvedRoleLabel}`}
                  data-testid="session-role-indicator"
                >
                  <span className="role-pill-head">Role</span>
                  <strong>{resolvedRoleLabel}</strong>
                </output>
              ) : null}
              <output className="strain-pill" aria-label="Current strain points">
                <div className="strain-pill-head">
                  <span>Strain</span>
                  {shouldShowTopBarStrainReset ? (
                    <button
                      type="button"
                      className="strain-reset-button"
                      aria-label="Reset strain points"
                      onClick={handleTopBarStrainReset}
                      disabled={!canResetStrain}
                    >
                      <LucideIcon
                        icon={RotateCcw}
                        className="strain-reset-icon"
                        size={14}
                        strokeWidth={2.2}
                      />
                    </button>
                  ) : null}
                </div>
                <strong>{resolvedStrainPoints}</strong>
              </output>
            </div>
          </div>
        </header>

        {sessionSummary && (sessionActionError || sessionConnectionMeta?.status === "error") ? (
          <section
            className="session-status-strip"
            aria-label="Multiplayer session status"
            data-testid="session-status-strip"
          >
            {sessionActionError ? (
              <p
                className="session-action-error"
                role="alert"
                data-testid="session-action-error"
              >
                {sessionActionError}
              </p>
            ) : null}
            {sessionConnectionMeta?.status === "error" ? (
              <div className="session-connection-error-row" aria-busy={isRetryPending}>
                <p
                  className="session-connection-error-copy"
                  role="alert"
                  data-testid="session-connection-error"
                >
                  {normalizeSessionText(
                    sessionConnectionMeta?.errorMessage,
                    "Unable to load multiplayer session.",
                  )}
                </p>
                <button
                  type="button"
                  className="join-secondary"
                  data-testid="session-retry-button"
                  onClick={handleRetryConnection}
                  disabled={sessionConnectionMeta?.status === "loading" || isRetryPending}
                >
                  Retry Connection
                </button>
                {isRetryPending ? (
                  <p
                    className="session-retry-status"
                    role="status"
                    aria-live="polite"
                    data-testid="session-retry-status"
                  >
                    Retrying connection...
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {sessionSummary ? (
          <section
            className="panel session-events-panel"
            aria-label="Multiplayer event feed"
            data-testid="session-events-feed"
          >
            <div className="session-events-head">
              <h2>Session Events</h2>
            </div>
            {visibleSessionEvents.length > 0 ? (
              <ol className="session-events-list">
                {visibleSessionEvents.map((event) => (
                  <li
                    key={event.id}
                    className="session-event-item"
                    data-testid="session-event-item"
                  >
                    <span className="session-event-id">#{event.id}</span>
                    <span>{event.summary}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="panel-copy session-events-empty">
                No multiplayer events yet.
              </p>
            )}
          </section>
        ) : null}

        <GmControlsPanel
          gmControls={gmControls}
          gmPendingAction={gmPendingAction}
          rotatedJoinLink={rotatedJoinLink}
          gmActionError={gmActionError}
          gmActionMessage={gmActionMessage}
          gmPlayers={gmPlayers}
          onRotateJoinLink={handleRotateJoinLink}
          onToggleJoining={handleToggleJoining}
          onResetSceneStrain={handleResetSceneStrain}
          onRefreshPlayers={handleRefreshPlayers}
          onCopyJoinLink={() => {
            void handleCopyJoinLink();
          }}
          onRevokePlayer={handleRevokePlayer}
        />

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
            rollModifier={rollModifier}
            onRollModifierChange={setRollModifier}
            importState={characterImport}
            onImportFile={importFromFile}
            onResetImport={resetImport}
            onSelectAttribute={setSelectedAttribute}
            onSelectSkill={setSelectedSkill}
            onPush={onPush}
            pushActionLabel={`Push ${pushableDiceCount} Dice`}
            isPushDisabled={isRolling || !hasRolled || !canPush || isActionSubmitPending}
            onClearDice={handleClearDice}
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
    sessionId: PropTypes.number,
    selfTokenId: PropTypes.number,
    selfDisplayName: PropTypes.string,
  }),
  sessionActions: PropTypes.shape({
    submitRoll: PropTypes.func,
    submitPush: PropTypes.func,
  }),
  sessionEvents: PropTypes.arrayOf(PropTypes.object),
  gmControls: PropTypes.shape({
    joiningEnabled: PropTypes.bool.isRequired,
    players: PropTypes.arrayOf(PropTypes.object).isRequired,
    rotateJoinLink: PropTypes.func,
    setJoiningEnabled: PropTypes.func,
    resetSceneStrain: PropTypes.func,
    refreshPlayers: PropTypes.func,
    revokePlayer: PropTypes.func,
  }),
  sessionConnectionMeta: PropTypes.shape({
    status: PropTypes.string,
    errorMessage: PropTypes.string,
    onRetry: PropTypes.func,
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

function App() {
  const [pathname, setPathname] = useState(getBrowserPathname);
  const [hash, setHash] = useState(getBrowserHash);
  const [, setAuthVersion] = useState(0);
  const isJoinRoute = isJoinSessionPath(pathname);
  const joinToken = parseJoinTokenFromHash(hash);
  const {
    sessionState,
    bootstrapFromAuth,
    submitRoll,
    submitPush,
    rotateJoinLink,
    setJoiningEnabled,
    resetSceneStrain,
    refreshPlayers,
    revokePlayer,
    resetSession,
  } = useMultiplayerSession();
  const sessionAuth = getSessionAuth();
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
      rotateJoinLink={rotateJoinLink}
      setJoiningEnabled={setJoiningEnabled}
      resetSceneStrain={resetSceneStrain}
      refreshPlayers={refreshPlayers}
      revokePlayer={revokePlayer}
      DiceRollerAppComponent={DiceRollerApp}
    />
  );
}

export default App;

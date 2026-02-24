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

const MAX_VISIBLE_SESSION_EVENTS = 20;

const normalizeSessionEventId = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.floor(numeric);
};

const normalizeSessionEventType = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
};

const normalizeSessionEventCount = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.floor(numeric);
};

const copyTextToClipboard = async (text) => {
  const normalizedText = typeof text === "string" ? text.trim() : "";

  if (!normalizedText) {
    return false;
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(normalizedText);
      return true;
    } catch {
      // Fallback path below handles environments without clipboard permission.
    }
  }

  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = normalizedText;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return Boolean(document.execCommand?.("copy"));
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
};

const normalizeSessionPlayerTokenId = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.floor(numeric);
};

const normalizeSessionPlayerDisplayName = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const normalizeSessionPlayersForGmPanel = (playersInput) => {
  if (!Array.isArray(playersInput)) {
    return [];
  }

  return playersInput
    .map((player) => {
      const tokenId = normalizeSessionPlayerTokenId(player?.tokenId);
      const displayName = normalizeSessionPlayerDisplayName(player?.displayName);
      const role = player?.role === "gm" || player?.role === "player"
        ? player.role
        : "player";

      if (tokenId === null || !displayName) {
        return null;
      }

      return {
        tokenId,
        displayName,
        role,
      };
    })
    .filter(Boolean);
};

const normalizeSessionEventActorLabel = (event) => {
  const displayName = event?.actor?.display_name;
  if (typeof displayName === "string" && displayName.trim()) {
    return displayName.trim();
  }

  const tokenId = normalizeSessionEventId(event?.actor?.token_id);
  if (tokenId !== null) {
    return `Player ${tokenId}`;
  }

  const payloadName = event?.payload?.display_name;
  if (typeof payloadName === "string" && payloadName.trim()) {
    return payloadName.trim();
  }

  return "Player";
};

const buildSessionEventSummary = (event) => {
  const eventType = normalizeSessionEventType(event?.type);
  const payload = event && typeof event.payload === "object" && event.payload
    ? event.payload
    : {};
  const actorLabel = normalizeSessionEventActorLabel(event);
  const successes = normalizeSessionEventCount(payload.successes);
  const banes = normalizeSessionEventCount(payload.banes);

  if (eventType === "roll") {
    return `${actorLabel} rolled ${successes} successes, ${banes} banes.`;
  }

  if (eventType === "push") {
    return `${actorLabel} pushed to ${successes} successes, ${banes} banes.`;
  }

  if (eventType === "join") {
    return `${actorLabel} joined the session.`;
  }

  if (eventType === "leave") {
    return `${actorLabel} left the session.`;
  }

  if (eventType === "strain_reset") {
    return "Scene strain was reset.";
  }

  return "Session event received.";
};

const normalizeSessionEventsForFeed = (eventsInput) => {
  if (!Array.isArray(eventsInput)) {
    return [];
  }

  const eventMap = new Map();

  for (const event of eventsInput) {
    if (!event || typeof event !== "object") {
      continue;
    }

    const eventId = normalizeSessionEventId(event.id);
    if (eventId === null || eventMap.has(eventId)) {
      continue;
    }

    eventMap.set(eventId, {
      id: eventId,
      type: normalizeSessionEventType(event.type),
      summary: buildSessionEventSummary(event),
    });
  }

  return Array.from(eventMap.values()).slice(-MAX_VISIBLE_SESSION_EVENTS);
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
  const [gmActionError, setGmActionError] = useState("");
  const [gmActionMessage, setGmActionMessage] = useState("");
  const [gmPendingAction, setGmPendingAction] = useState("");
  const [rotatedJoinLink, setRotatedJoinLink] = useState("");
  const [isRetryPending, setIsRetryPending] = useState(false);
  const visibleSessionEvents = useMemo(
    () => normalizeSessionEventsForFeed(sessionEvents),
    [sessionEvents],
  );
  const gmPlayers = useMemo(
    () => normalizeSessionPlayersForGmPanel(gmControls?.players),
    [gmControls?.players],
  );

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
  const retryPendingRef = useRef(false);
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

  const runGmAction = useCallback(
    async (actionId, action, successMessage, onSuccess = null) => {
      if (typeof action !== "function") {
        return;
      }

      setGmPendingAction(actionId);
      setGmActionError("");
      setGmActionMessage("");

      try {
        const result = await action();

        if (!isMountedRef.current) {
          return;
        }

        if (!result?.ok) {
          setGmActionError(
            normalizeActionErrorMessage(result?.errorMessage) ||
              "Unable to complete GM action.",
          );
          return;
        }

        if (typeof onSuccess === "function") {
          onSuccess(result);
        }

        setGmActionMessage(successMessage);
      } catch {
        if (!isMountedRef.current) {
          return;
        }

        setGmActionError("Unable to complete GM action.");
      } finally {
        if (isMountedRef.current) {
          setGmPendingAction("");
        }
      }
    },
    [],
  );

  const handleRotateJoinLink = useCallback(() => {
    if (!gmControls) {
      return;
    }

    void runGmAction(
      "rotate_join_link",
      gmControls.rotateJoinLink,
      "Join link rotated.",
      (result) => {
        setRotatedJoinLink(
          typeof result?.joinLink === "string" ? result.joinLink.trim() : "",
        );
      },
    );
  }, [gmControls, runGmAction]);

  const handleToggleJoining = useCallback(() => {
    if (!gmControls) {
      return;
    }

    const nextJoiningEnabled = !Boolean(gmControls.joiningEnabled);

    void runGmAction(
      "toggle_joining",
      () => gmControls.setJoiningEnabled?.(nextJoiningEnabled),
      nextJoiningEnabled ? "Player joining enabled." : "Player joining disabled.",
    );
  }, [gmControls, runGmAction]);

  const handleResetSceneStrain = useCallback(() => {
    if (!gmControls) {
      return;
    }

    void runGmAction(
      "reset_scene_strain",
      gmControls.resetSceneStrain,
      "Scene strain reset.",
    );
  }, [gmControls, runGmAction]);

  const handleRefreshPlayers = useCallback(() => {
    if (!gmControls) {
      return;
    }

    void runGmAction(
      "refresh_players",
      gmControls.refreshPlayers,
      "Player list refreshed.",
    );
  }, [gmControls, runGmAction]);

  const handleRevokePlayer = useCallback(
    (tokenId, displayName) => {
      if (!gmControls) {
        return;
      }

      void runGmAction(
        `revoke_player_${tokenId}`,
        () => gmControls.revokePlayer?.(tokenId),
        `${displayName} revoked.`,
      );
    },
    [gmControls, runGmAction],
  );

  const handleCopyJoinLink = useCallback(async () => {
    const joinLink = typeof rotatedJoinLink === "string" ? rotatedJoinLink.trim() : "";

    if (!joinLink) {
      return;
    }

    setGmActionError("");
    setGmActionMessage("");

    const copied = await copyTextToClipboard(joinLink);
    if (!isMountedRef.current) {
      return;
    }

    if (!copied) {
      setGmActionError("Unable to copy join link. Copy it manually from the link text.");
      return;
    }

    setGmActionMessage("Join link copied.");
  }, [rotatedJoinLink]);

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
            {sessionConnectionMeta?.status === "error" ? (
              <div className="session-connection-error-row" aria-busy={isRetryPending}>
                <p
                  className="panel-copy session-connection-error-copy"
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
                    className="panel-copy session-retry-status"
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

        {gmControls ? (
          <section
            className="panel gm-controls-panel"
            aria-label="GM controls"
            data-testid="gm-controls-panel"
          >
            <div className="gm-controls-head">
              <h2>GM Controls</h2>
              <span className="gm-controls-pill">Host Tools</span>
            </div>
            <div className="gm-controls-actions">
              <button
                type="button"
                className="join-secondary"
                data-testid="gm-rotate-link-button"
                onClick={handleRotateJoinLink}
                disabled={Boolean(gmPendingAction)}
              >
                Rotate Join Link
              </button>
              <button
                type="button"
                className="join-secondary"
                data-testid="gm-joining-toggle-button"
                onClick={handleToggleJoining}
                disabled={Boolean(gmPendingAction)}
              >
                {gmControls.joiningEnabled ? "Disable Joining" : "Enable Joining"}
              </button>
              <button
                type="button"
                className="join-secondary"
                data-testid="gm-reset-strain-button"
                onClick={handleResetSceneStrain}
                disabled={Boolean(gmPendingAction)}
              >
                Reset Scene Strain
              </button>
              <button
                type="button"
                className="join-secondary"
                data-testid="gm-refresh-players-button"
                onClick={handleRefreshPlayers}
                disabled={Boolean(gmPendingAction)}
              >
                Refresh Players
              </button>
            </div>
            {rotatedJoinLink ? (
              <div className="gm-controls-link-row" data-testid="gm-join-link-row">
                <p className="panel-copy gm-controls-link" data-testid="gm-join-link">
                  Latest join link: <code>{rotatedJoinLink}</code>
                </p>
                <button
                  type="button"
                  className="join-secondary"
                  data-testid="gm-copy-link-button"
                  onClick={() => {
                    void handleCopyJoinLink();
                  }}
                  disabled={Boolean(gmPendingAction)}
                >
                  Copy Join Link
                </button>
              </div>
            ) : null}
            {gmActionError ? (
              <p
                className="panel-copy gm-controls-error"
                role="alert"
                data-testid="gm-action-error"
              >
                {gmActionError}
              </p>
            ) : null}
            {gmPendingAction ? (
              <p
                className="panel-copy gm-controls-message"
                role="status"
                aria-live="polite"
                data-testid="gm-action-pending"
              >
                Applying GM action...
              </p>
            ) : null}
            {gmActionMessage ? (
              <p
                className="panel-copy gm-controls-message"
                role="status"
                aria-live="polite"
                data-testid="gm-action-message"
              >
                {gmActionMessage}
              </p>
            ) : null}
            <div className="gm-player-roster">
              <h3>Player Roster</h3>
              {gmPlayers.length > 0 ? (
                <ul className="gm-player-list" data-testid="gm-player-list">
                  {gmPlayers.map((player) => {
                    const canRevoke = player.role !== "gm";
                    return (
                      <li key={player.tokenId} className="gm-player-item">
                        <div className="gm-player-details">
                          <strong>{player.displayName}</strong>
                          <span>
                            #{player.tokenId} • {player.role.toUpperCase()}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="join-secondary"
                          data-testid={`gm-revoke-player-${player.tokenId}`}
                          onClick={() =>
                            handleRevokePlayer(player.tokenId, player.displayName)
                          }
                          disabled={!canRevoke || Boolean(gmPendingAction)}
                        >
                          Revoke
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="panel-copy gm-player-empty">No players are connected.</p>
              )}
            </div>
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
  rotateJoinLink,
  setJoiningEnabled,
  resetSceneStrain,
  refreshPlayers,
  revokePlayer,
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
  const resolvedGmControls = useMemo(() => {
    if (sessionState?.role !== "gm") {
      return null;
    }

    return {
      joiningEnabled: Boolean(sessionState?.joiningEnabled),
      players: Array.isArray(sessionState?.players) ? sessionState.players : [],
      rotateJoinLink,
      setJoiningEnabled,
      resetSceneStrain,
      refreshPlayers,
      revokePlayer,
    };
  }, [
    refreshPlayers,
    resetSceneStrain,
    revokePlayer,
    rotateJoinLink,
    sessionState?.joiningEnabled,
    sessionState?.players,
    sessionState?.role,
    setJoiningEnabled,
  ]);

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
      sessionEvents={Array.isArray(sessionState?.events) ? sessionState.events : []}
      gmControls={resolvedGmControls}
      sessionConnectionMeta={{
        status: sessionState?.status ?? "idle",
        errorMessage: normalizeSessionText(sessionState?.errorMessage, ""),
        onRetry: bootstrapFromAuth,
      }}
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
  rotateJoinLink: PropTypes.func,
  setJoiningEnabled: PropTypes.func,
  resetSceneStrain: PropTypes.func,
  refreshPlayers: PropTypes.func,
  revokePlayer: PropTypes.func,
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
    rotateJoinLink,
    setJoiningEnabled,
    resetSceneStrain,
    refreshPlayers,
    revokePlayer,
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
      rotateJoinLink={rotateJoinLink}
      setJoiningEnabled={setJoiningEnabled}
      resetSceneStrain={resetSceneStrain}
      refreshPlayers={refreshPlayers}
      revokePlayer={revokePlayer}
    />
  );
}

export default App;

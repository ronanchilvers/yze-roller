import { useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import {
  normalizeSessionCount,
  normalizeSessionPlayerDisplayName,
  normalizeSessionPlayerTokenId,
  normalizeSessionText,
} from "../lib/session-event-normalize.js";

export const buildConnectionSummary = (sessionState) => {
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
  DiceRollerAppComponent,
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
    <DiceRollerAppComponent
      sessionSummary={{
        sessionId: normalizeSessionCount(sessionState?.sessionId),
        connectionStatus: connectionSummary.label,
        connectionTone: connectionSummary.tone,
        roleLabel,
        sessionName,
        sceneStrain,
        selfTokenId:
          normalizeSessionPlayerTokenId(sessionState?.self?.tokenId) ?? undefined,
        selfDisplayName: normalizeSessionPlayerDisplayName(
          sessionState?.self?.displayName,
        ),
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
    joiningEnabled: PropTypes.bool,
    sceneStrain: PropTypes.number,
    players: PropTypes.arrayOf(PropTypes.object),
    self: PropTypes.shape({
      tokenId: PropTypes.number,
      displayName: PropTypes.string,
    }),
    events: PropTypes.arrayOf(PropTypes.object),
    errorMessage: PropTypes.string,
  }),
  bootstrapFromAuth: PropTypes.func.isRequired,
  submitRoll: PropTypes.func,
  submitPush: PropTypes.func,
  rotateJoinLink: PropTypes.func,
  setJoiningEnabled: PropTypes.func,
  resetSceneStrain: PropTypes.func,
  refreshPlayers: PropTypes.func,
  revokePlayer: PropTypes.func,
  DiceRollerAppComponent: PropTypes.elementType.isRequired,
};

export default SessionView;

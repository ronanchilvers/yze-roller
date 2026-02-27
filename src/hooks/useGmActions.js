import { useCallback, useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "../lib/clipboard.js";
import { normalizeActionErrorMessage } from "../lib/session-action-helpers.js";

export const useGmActions = ({ gmControls }) => {
  const [gmActionError, setGmActionError] = useState("");
  const [gmActionMessage, setGmActionMessage] = useState("");
  const [gmPendingAction, setGmPendingAction] = useState("");
  const [rotatedJoinLink, setRotatedJoinLink] = useState("");

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

    const nextJoiningEnabled = !gmControls.joiningEnabled;

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
      "Strain points reset.",
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

  return {
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
  };
};

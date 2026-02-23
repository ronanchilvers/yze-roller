import { useState } from "react";
import PropTypes from "prop-types";
import { apiPost, isApiClientError } from "../lib/api-client.js";

const mapJoinErrorCodeToMessage = (code) => {
  switch (code) {
    case "JOIN_DISABLED":
      return "Joining is currently disabled for this session.";
    case "JOIN_TOKEN_REVOKED":
    case "TOKEN_REVOKED":
      return "This join link has expired. Ask the GM for a new invite link.";
    case "TOKEN_MISSING":
    case "TOKEN_INVALID":
      return "This join link is invalid.";
    case "RATE_LIMITED":
      return "Too many join attempts. Please wait and try again.";
    case "VALIDATION_ERROR":
      return "Display name must be between 1 and 64 characters.";
    default:
      return "Unable to join right now. Please try again.";
  }
};

const normalizeJoinSuccessData = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const sessionToken =
    typeof payload.player_token === "string" ? payload.player_token.trim() : "";
  const sessionId = Number(payload.session_id);
  const player = payload.player && typeof payload.player === "object"
    ? payload.player
    : null;

  if (!sessionToken || !Number.isFinite(sessionId) || sessionId <= 0) {
    return null;
  }

  return {
    sessionToken,
    sessionId: Math.floor(sessionId),
    role: player?.role === "gm" || player?.role === "player" ? player.role : null,
    self: player,
  };
};

function JoinSessionView({
  joinToken = null,
  onJoinSuccess = () => {},
  onExitJoin = () => {},
}) {
  const [displayName, setDisplayName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasJoinToken = typeof joinToken === "string" && joinToken.trim().length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!hasJoinToken || isSubmitting) {
      return;
    }

    const trimmedName = displayName.trim();

    if (!trimmedName) {
      setErrorMessage("Enter a display name to join the session.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await apiPost(
        "/join",
        {
          display_name: trimmedName,
        },
        {
          token: joinToken,
        },
      );
      const authState = normalizeJoinSuccessData(response.data);

      if (!authState) {
        setErrorMessage("Join response was invalid. Please try again.");
        return;
      }

      onJoinSuccess(authState);
    } catch (error) {
      if (isApiClientError(error)) {
        setErrorMessage(mapJoinErrorCodeToMessage(error.code));
      } else {
        setErrorMessage("Unable to reach the server. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="app-shell join-shell">
      <section className="panel join-panel" aria-label="Join multiplayer session">
        <header className="join-header">
          <p className="eyebrow">Multiplayer</p>
          <h1>Join Session</h1>
        </header>

        {!hasJoinToken ? (
          <div className="join-error-block" role="alert">
            <p className="join-error-title">Invalid join link</p>
            <p className="panel-copy">
              This URL is missing a join token. Open the invite link from your GM and
              try again.
            </p>
            <button type="button" className="join-secondary" onClick={onExitJoin}>
              Back to app
            </button>
          </div>
        ) : (
          <form className="join-form" onSubmit={handleSubmit}>
            <label htmlFor="displayName" className="join-label">
              Display Name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              value={displayName}
              onInput={(event) => setDisplayName(event.target.value)}
              maxLength={64}
              autoComplete="nickname"
              className="join-input"
            />

            {errorMessage ? (
              <p className="panel-copy join-error-message" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <div className="join-actions">
              <button type="submit" className="pool-action-button" disabled={isSubmitting}>
                {isSubmitting ? "Joining…" : "Join session"}
              </button>
              <button
                type="button"
                className="join-secondary"
                onClick={onExitJoin}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

JoinSessionView.propTypes = {
  joinToken: PropTypes.string,
  onJoinSuccess: PropTypes.func,
  onExitJoin: PropTypes.func,
};

export default JoinSessionView;

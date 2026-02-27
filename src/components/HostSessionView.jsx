import { useState } from "react";
import PropTypes from "prop-types";
import { apiPost, isApiClientError } from "../lib/api-client.js";
import { parseJoinTokenFromInviteInput } from "../lib/join-session-route.js";

const mapCreateSessionErrorCodeToMessage = (code) => {
  switch (code) {
    case "VALIDATION_ERROR":
      return "Session name must be between 1 and 128 characters.";
    case "RATE_LIMITED":
      return "Too many session creation attempts. Please wait and try again.";
    default:
      return "Unable to create session right now. Please try again.";
  }
};

const normalizeCreateSessionSuccessData = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const sessionToken =
    typeof payload.gm_token === "string" ? payload.gm_token.trim() : "";
  const sessionId = Number(payload.session_id);

  if (!sessionToken || !Number.isFinite(sessionId) || sessionId <= 0) {
    return null;
  }

  return {
    sessionToken,
    sessionId: Math.floor(sessionId),
    role: "gm",
    self: null,
  };
};

function HostSessionView({
  onHostSuccess = () => {},
  onUseInviteLink = () => {},
}) {
  const [sessionName, setSessionName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteLinkInput, setInviteLinkInput] = useState("");
  const [inviteErrorMessage, setInviteErrorMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedName = sessionName.trim();

    if (!trimmedName) {
      setErrorMessage("Enter a session name to create a game.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await apiPost("/sessions", {
        session_name: trimmedName,
      });
      const authState = normalizeCreateSessionSuccessData(response.data);

      if (!authState) {
        setErrorMessage("Create session response was invalid. Please try again.");
        return;
      }

      onHostSuccess(authState);
    } catch (error) {
      if (isApiClientError(error)) {
        setErrorMessage(mapCreateSessionErrorCodeToMessage(error.code));
      } else {
        setErrorMessage("Unable to reach the server. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteLinkSubmit = (event) => {
    event.preventDefault();

    const parsedJoinToken = parseJoinTokenFromInviteInput(inviteLinkInput);
    if (!parsedJoinToken) {
      setInviteErrorMessage("Paste a valid invite link or join token.");
      return;
    }

    setInviteErrorMessage("");
    onUseInviteLink(parsedJoinToken);
  };

  return (
    <main className="app-shell join-shell" data-mode="host">
      <section className="panel join-panel" aria-label="Host multiplayer session">
        <header className="join-header">
          <p className="eyebrow">Multiplayer</p>
          <h1>Host Game</h1>
        </header>

        <form className="join-form" onSubmit={handleSubmit}>
          <label htmlFor="sessionName" className="join-label">
            Session Name
          </label>
          <input
            id="sessionName"
            name="sessionName"
            type="text"
            value={sessionName}
            onInput={(event) => setSessionName(event.target.value)}
            maxLength={128}
            autoComplete="off"
            className="join-input"
          />

          {errorMessage ? (
            <p className="panel-copy join-error-message" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button type="submit" className="pool-action-button" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create session"}
          </button>
        </form>

        <p className="panel-copy">
          Already have an invite link? Paste it to join as a player.
        </p>
        <form className="join-form" onSubmit={handleInviteLinkSubmit}>
          <label htmlFor="inviteLinkInput" className="join-label">
            Invite Link
          </label>
          <input
            id="inviteLinkInput"
            name="inviteLinkInput"
            type="text"
            value={inviteLinkInput}
            onInput={(event) => setInviteLinkInput(event.target.value)}
            autoComplete="off"
            className="join-input"
          />

          {inviteErrorMessage ? (
            <p className="panel-copy join-error-message" role="alert">
              {inviteErrorMessage}
            </p>
          ) : null}

          <button type="submit" className="join-secondary">
            Use invite link
          </button>
        </form>
      </section>
    </main>
  );
}

HostSessionView.propTypes = {
  onHostSuccess: PropTypes.func,
  onUseInviteLink: PropTypes.func,
};

export default HostSessionView;

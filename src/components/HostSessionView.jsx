import { useState } from "react";
import PropTypes from "prop-types";
import { apiPost, isApiClientError } from "../lib/api-client.js";

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

function HostSessionView({ onHostSuccess = () => {} }) {
  const [sessionName, setSessionName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      </section>
    </main>
  );
}

HostSessionView.propTypes = {
  onHostSuccess: PropTypes.func,
};

export default HostSessionView;

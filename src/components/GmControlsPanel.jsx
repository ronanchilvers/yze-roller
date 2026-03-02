import { useId, useState } from "react";
import PropTypes from "prop-types";

function GmControlsPanel({
  gmControls,
  gmPendingAction,
  gmActionError,
  gmActionMessage,
  gmPlayers,
  onRevokePlayer,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  if (!gmControls) {
    return null;
  }

  return (
    <section
      className="panel gm-controls-panel"
      aria-label="GM controls"
      data-testid="gm-controls-panel"
    >
      <div className="panel-accordion-head">
        <h2>GM Controls</h2>
        <button
          type="button"
          className="join-secondary panel-accordion-toggle"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          data-testid="gm-controls-toggle"
          onClick={() => {
            setIsExpanded((current) => !current);
          }}
        >
          {isExpanded ? "Hide" : "Show"}
        </button>
      </div>
      {isExpanded ? (
        <div id={contentId} data-testid="gm-controls-content">
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
                        onClick={() => onRevokePlayer(player.tokenId, player.displayName)}
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
        </div>
      ) : null}
    </section>
  );
}

GmControlsPanel.propTypes = {
  gmControls: PropTypes.object,
  gmPendingAction: PropTypes.string.isRequired,
  gmActionError: PropTypes.string.isRequired,
  gmActionMessage: PropTypes.string.isRequired,
  gmPlayers: PropTypes.arrayOf(
    PropTypes.shape({
      tokenId: PropTypes.number.isRequired,
      displayName: PropTypes.string.isRequired,
      role: PropTypes.oneOf(["gm", "player"]).isRequired,
    }),
  ).isRequired,
  onRevokePlayer: PropTypes.func.isRequired,
};

export default GmControlsPanel;

import PropTypes from "prop-types";

function GmControlsPanel({
  gmControls,
  gmPendingAction,
  rotatedJoinLink,
  gmActionError,
  gmActionMessage,
  gmPlayers,
  onRotateJoinLink,
  onToggleJoining,
  onResetSceneStrain,
  onRefreshPlayers,
  onCopyJoinLink,
  onRevokePlayer,
}) {
  if (!gmControls) {
    return null;
  }

  return (
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
          onClick={onRotateJoinLink}
          disabled={Boolean(gmPendingAction)}
        >
          Rotate Join Link
        </button>
        <button
          type="button"
          className="join-secondary"
          data-testid="gm-joining-toggle-button"
          onClick={onToggleJoining}
          disabled={Boolean(gmPendingAction)}
        >
          {gmControls.joiningEnabled ? "Disable Joining" : "Enable Joining"}
        </button>
        <button
          type="button"
          className="join-secondary"
          data-testid="gm-reset-strain-button"
          onClick={onResetSceneStrain}
          disabled={Boolean(gmPendingAction)}
        >
          Reset Strain Points
        </button>
        <button
          type="button"
          className="join-secondary"
          data-testid="gm-refresh-players-button"
          onClick={onRefreshPlayers}
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
            onClick={onCopyJoinLink}
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
    </section>
  );
}

GmControlsPanel.propTypes = {
  gmControls: PropTypes.shape({
    joiningEnabled: PropTypes.bool.isRequired,
  }),
  gmPendingAction: PropTypes.string.isRequired,
  rotatedJoinLink: PropTypes.string.isRequired,
  gmActionError: PropTypes.string.isRequired,
  gmActionMessage: PropTypes.string.isRequired,
  gmPlayers: PropTypes.arrayOf(
    PropTypes.shape({
      tokenId: PropTypes.number.isRequired,
      displayName: PropTypes.string.isRequired,
      role: PropTypes.oneOf(["gm", "player"]).isRequired,
    }),
  ).isRequired,
  onRotateJoinLink: PropTypes.func.isRequired,
  onToggleJoining: PropTypes.func.isRequired,
  onResetSceneStrain: PropTypes.func.isRequired,
  onRefreshPlayers: PropTypes.func.isRequired,
  onCopyJoinLink: PropTypes.func.isRequired,
  onRevokePlayer: PropTypes.func.isRequired,
};

export default GmControlsPanel;

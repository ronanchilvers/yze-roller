import PropTypes from "prop-types";

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

export default MultiplayerAuthLostView;

import { useCallback, useEffect, useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Settings } from "lucide-react";
import LucideIcon from "./LucideIcon.jsx";

function GmHostToolsMenu({
  gmControls,
  gmPendingAction,
  rotatedJoinLink,
  onRotateJoinLink,
  onToggleJoining,
  onResetSceneStrain,
  onRefreshPlayers,
  onCopyJoinLink,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRootRef = useRef(null);
  const toggleButtonRef = useRef(null);
  const menuId = useId();

  const toggleMenu = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const handleMenuAction = useCallback((action) => {
    if (typeof action !== "function") {
      return;
    }

    setIsOpen(false);
    action();
  }, []);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!menuRootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      setIsOpen(false);
      toggleButtonRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!gmControls) {
    return null;
  }

  return (
    <div
      className="gm-host-tools-menu"
      data-testid="gm-host-tools-container"
      ref={menuRootRef}
    >
      <button
        ref={toggleButtonRef}
        type="button"
        className="join-secondary gm-host-tools-toggle"
        aria-label="Open host tools"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        data-testid="gm-host-tools-toggle"
        onClick={toggleMenu}
      >
        <LucideIcon
          icon={Settings}
          className="gm-host-tools-toggle-icon"
          size={15}
          strokeWidth={2.2}
        />
      </button>
      {isOpen ? (
        <div
          id={menuId}
          className="gm-host-tools-dropdown"
          role="menu"
          aria-label="Host tools"
          data-testid="gm-host-tools-menu"
        >
          <div className="gm-host-tools-group" role="none">
            <button
              type="button"
              role="menuitem"
              className="gm-host-tools-menu-item"
              data-testid="gm-rotate-link-button"
              onClick={() => {
                handleMenuAction(onRotateJoinLink);
              }}
              disabled={Boolean(gmPendingAction)}
            >
              Rotate Join Link
            </button>
            <button
              type="button"
              role="menuitem"
              className="gm-host-tools-menu-item"
              data-testid="gm-joining-toggle-button"
              onClick={() => {
                handleMenuAction(onToggleJoining);
              }}
              disabled={Boolean(gmPendingAction)}
            >
              {gmControls.joiningEnabled ? "Disable Joining" : "Enable Joining"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="gm-host-tools-menu-item"
              data-testid="gm-reset-strain-button"
              onClick={() => {
                handleMenuAction(onResetSceneStrain);
              }}
              disabled={Boolean(gmPendingAction)}
            >
              Reset Strain Points
            </button>
            <button
              type="button"
              role="menuitem"
              className="gm-host-tools-menu-item"
              data-testid="gm-refresh-players-button"
              onClick={() => {
                handleMenuAction(onRefreshPlayers);
              }}
              disabled={Boolean(gmPendingAction)}
            >
              Refresh Players
            </button>
          </div>
          {rotatedJoinLink ? (
            <div
              className="gm-host-tools-group gm-host-tools-link-group"
              role="none"
              data-testid="gm-join-link-row"
            >
              <p className="gm-host-tools-link" data-testid="gm-join-link">
                Latest join link: <code>{rotatedJoinLink}</code>
              </p>
              <button
                type="button"
                role="menuitem"
                className="gm-host-tools-menu-item"
                data-testid="gm-copy-link-button"
                onClick={() => {
                  handleMenuAction(onCopyJoinLink);
                }}
                disabled={Boolean(gmPendingAction)}
              >
                Copy Join Link
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

GmHostToolsMenu.propTypes = {
  gmControls: PropTypes.shape({
    joiningEnabled: PropTypes.bool.isRequired,
  }),
  gmPendingAction: PropTypes.string.isRequired,
  rotatedJoinLink: PropTypes.string.isRequired,
  onRotateJoinLink: PropTypes.func.isRequired,
  onToggleJoining: PropTypes.func.isRequired,
  onResetSceneStrain: PropTypes.func.isRequired,
  onRefreshPlayers: PropTypes.func.isRequired,
  onCopyJoinLink: PropTypes.func.isRequired,
};

export default GmHostToolsMenu;

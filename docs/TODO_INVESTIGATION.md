# TODO Investigation Tracker

- **Question:** Should dark mode support a `system` preference (auto-follow OS theme) or only a manual light/dark toggle?
  - **Best lead(s):** `src/App.jsx` (top-bar controls), `src/index.css` (`color-scheme`), `src/lib/pool-persistence.js` (pattern for persisted user preferences).
  - **Status:** answered — use `system` mode by default with manual `light`/`dark` overrides.

- **Question:** Should Year Zero use a dedicated `diceResult` toast variant or standard `alert` toasts for roll outcomes?
  - **Best lead(s):** `src/App.jsx` (current roll summary generation), `src/hooks/useRollSession.js` (roll completion events), `docs/plans/2026-02-18 Toast Alert Integration Plan.md` (proposed mapping), and Fate Cards reference `/tmp/fate-cards/src/components/toast/ToastContainer.jsx`.
  - **Status:** answered — use `diceResult` mode for roll results with initial duration `10000ms` (10s).

- **Question:** What policy should handle high-volume remote roll events (queue cap/collapse/priority)?
  - **Best lead(s):** `docs/plans/2026-02-18 Toast Alert Integration Plan.md` (risks + open decisions), planned provider queue logic in `src/components/toast/ToastProvider.jsx`.
  - **Status:** answered — use a pending buffer of 20 and drop oldest on overflow.

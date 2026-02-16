# TODO Investigation Tracker

- **Question:** Should dark mode support a `system` preference (auto-follow OS theme) or only a manual light/dark toggle?
  - **Best lead(s):** `src/App.jsx` (top-bar controls), `src/index.css` (`color-scheme`), `src/lib/pool-persistence.js` (pattern for persisted user preferences).
  - **Status:** answered — use `system` mode by default with manual `light`/`dark` overrides.

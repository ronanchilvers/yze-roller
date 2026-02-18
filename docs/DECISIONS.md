# Decisions

- **2026-02-14 — Character import schema and validation**
  - **Context:** Importing character JSON with `attribute_*` and `skill_*` fields, canonical skills defined by mapping file. Attributes are required and must be integers ≥ 1; skills default to 0 if missing or empty.
  - **Decision:** Enforce required attributes and integer-only dice values. Treat missing/empty skill values as 0 without failing import. Ignore non-canonical skills.
  - **Consequences:** Imports fail fast on missing/invalid attributes; skill omissions are resilient and do not block import. Users can still roll skills with 0 dice.
  - **Alternatives considered:** Treat missing skills as validation errors (rejected to keep imports forgiving).

- **2026-02-14 — UI flow for imported rolls**
  - **Context:** Dice Pool panel now includes manual and import tabs.
  - **Decision:** Import tab auto-selects the mapped attribute when a skill is chosen and locks attribute selection while a skill is selected. Imported roll uses attribute + skill counts; push actions defer to the existing primary action behavior.
  - **Consequences:** Fewer mismatched skill/attribute rolls and a consistent push workflow across tabs.
  - **Alternatives considered:** Allow manual attribute override even when a skill is chosen (rejected to avoid rule violations).

- **2026-02-14 — Display name formatting**
  - **Context:** Character identity fields may be partial in JSON.
  - **Decision:** Display name format is `firstname "nickname" lastname`, with sensible fallbacks to available parts and a generic label if absent.
  - **Consequences:** User-facing name is consistent and readable even with incomplete data.
  - **Alternatives considered:** Use only `firstname lastname` (rejected because nickname was preferred).

  - **2026-02-14 — Import UI quick-roll and simplified controls**
    - **Context:** Import tab needed faster roll access and a cleaner layout.
    - **Decision:** Replace attribute/skill dropdowns with clickable counts in the import summary for quick rolls, keep the JSON upload field always visible, and remove the import tab roll button. Split roll and push actions so “Roll Dice” always starts a new roll and “Push X Dice” is a separate action.
    - **Consequences:** Import tab is simpler and quicker to use; roll behavior is explicit and avoids accidental pushes.
    - **Alternatives considered:** Keep dropdown-based rolls and a shared roll/push button (rejected for clarity and speed).

- **2026-02-16 — Dark mode includes system preference**
  - **Context:** The app needed dark mode support without forcing users to manually switch when their OS theme changes.
  - **Decision:** Implement a 3-way theme preference (`system`, `light`, `dark`) persisted in localStorage, with `system` as default and runtime resolution via `prefers-color-scheme`.
  - **Consequences:** Theme follows OS automatically by default while still allowing user overrides; styles are maintained via CSS token overrides rooted at `:root[data-theme="..."]`.
  - **Alternatives considered:** Manual light/dark toggle only (rejected because it ignores OS preference changes).

- **2026-02-18 — Toast mechanism strategy for roll results**
  - **Context:** Roll outcomes are currently announced inline in `src/App.jsx` (`trayLead` / `tray-results`), and a reusable toast pattern already exists in `ronanchilvers/fate-cards` (`src/components/toast` + `useToast`).
  - **Decision:** Adopt the Fate Cards toast architecture (provider, container, hook, timer cleanup, fallback API) and route Year Zero roll-result announcements through toasts while preserving push/clear controls and history tracking.
  - **Consequences:** Result feedback becomes transient and reusable across future UI flows; integration requires careful dedupe to avoid repeated toasts per render and accessibility tuning to avoid duplicate live announcements.
  - **Alternatives considered:** Keep inline-only result display (rejected for lower reuse and weaker cross-feature notification consistency).

- **2026-02-18 — Source-agnostic roll-event ingestion for toasts**
  - **Context:** Future multiplayer/API support may deliver roll results from remote players rather than local roll resolution only.
  - **Decision:** Define a normalized roll-event adapter and route both local and remote events through one shared toast emission path with id/key dedupe.
  - **Consequences:** Toast behavior remains consistent across event sources and is resilient to replayed/duplicate remote events; additional helper tests are required for malformed external payloads.
  - **Alternatives considered:** Directly trigger toasts from each source path (rejected due to duplicated logic and higher drift risk).

- **2026-02-18 — Roll toast defaults and queue policy**
  - **Context:** Open implementation choices remained for toast display mode, duration, actor labeling, queue overflow handling, and confirm API scope.
  - **Decision:** Use `diceResult` mode for roll outcomes, default duration `10000ms`, source-agnostic ingestion layer required now, remote label based on `actorId`, and pending queue policy of 20 items with oldest-first dropping. Defer confirm API usage for now.
  - **Consequences:** Roll-result presentation is consistent and fixed for initial delivery; queue behavior under bursty remote events is deterministic; upstream systems still own how `actorId` is represented to users.
  - **Alternatives considered:** `alert` mode for roll results, shorter duration defaults, and summarized/drop-newest overflow policies.

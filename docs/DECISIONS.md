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

- **2026-02-18 — Move push/clear controls into the main panel and remove tray results UI**
  - **Context:** With toast-based roll feedback in place, the old tray results/history panel duplicated result messaging while still owning push/clear controls.
  - **Decision:** Remove the tray results panel from `App` and render `Push X Dice` plus `Clear Dice` controls in `DicePoolPanel` footer, side-by-side on desktop and stacked on mobile.
  - **Consequences:** Layout is simpler, controls stay in the primary panel regardless of tab, and redundant inline result/history UI is eliminated.
  - **Alternatives considered:** Keep tray panel only for controls (rejected to avoid a split interaction surface).

- **2026-02-18 — Clamp imported skill dice to Year Zero limits**
  - **Context:** Character import accepted canonical skill values above expected table limits, while invalid/malformed values were already reset to 0.
  - **Decision:** Accept imported skill dice only when the value is an integer between 0 and 10 inclusive; otherwise reset that skill to 0 and keep import valid with a warning.
  - **Consequences:** Imported skill pools now stay within expected game bounds and malformed/out-of-range inputs are handled safely without aborting import.
  - **Alternatives considered:** Hard-fail import on out-of-range values (rejected to preserve forgiving import behavior).

- **2026-02-18 — Defer manual dice input normalization until roll**
  - **Context:** Immediate normalization in manual input change handlers forced fallback values while users were editing, making it hard to clear and replace numbers.
  - **Decision:** Keep manual input fields as draft strings and run normalization/commit only when the manual `Roll Dice` action is triggered.
  - **Consequences:** Users can clear and retype values naturally; persisted pool counts and roll execution still use normalized numeric bounds.
  - **Alternatives considered:** Keep on-change normalization and rely on cursor UX workarounds (rejected due to poor editing ergonomics).

- **2026-03-04 — Replace strain reset pill with editable stepper**
  - **Context:** The top-bar strain display exposed only a reset action, but users needed direct manual control over the current strain dice count.
  - **Decision:** Rename the widget label to `Strain Dice` and replace reset with explicit decrement/increment (`-`/`+`) controls flanking a centered value.
  - **Consequences:** Strain can now be adjusted one die at a time from the top bar; decrement is clamped at zero through `useStrainTracker` normalization helpers.
  - **Alternatives considered:** Keep reset-only controls plus manual input field (rejected for slower interaction and unnecessary UI complexity).

- **2026-03-04 — Replace dice modifier slider with top-bar stepper**
  - **Context:** Modifier adjustments were on a panel slider separate from the new top-bar strain stepper and used different interaction semantics.
  - **Decision:** Remove the `Dice Modifier` slider from `DicePoolPanel` and add a top-bar `Modifier` stepper that mirrors the Strain Dice control pattern, with clamped bounds of `-3..+3`.
  - **Consequences:** Modifier and strain controls now share one interaction model and location; modifier theming is now handled by dedicated purple pill tokens in `App.css`.
  - **Alternatives considered:** Keep slider and add duplicate top-bar control (rejected to avoid redundant state controls and UI clutter).

- **2026-03-04 — Import key-attribute bonus applies only to import quick-rolls**
  - **Context:** Imported JSON now includes `archetype` and `attribute` fields for class identity and key attribute die bonuses, while manual rolls do not carry explicit imported attribute context.
  - **Decision:** Parse and normalize archetype/key-attribute metadata during import, display imported names as `<name> - <archetype>`, highlight the key attribute in summary UI, and apply a single key-attribute bonus die only for import quick-rolls where the clicked attribute matches the imported key attribute.
  - **Consequences:** Bonus behavior is deterministic and tied to explicit import actions; manual tab rolls remain unchanged and cannot accidentally gain imported bonuses.
  - **Alternatives considered:** Apply key bonus to manual rolls whenever a character is loaded (rejected due to ambiguous attribute intent in manual mode).

- **2026-03-04 — Key attribute die removal ordering under negative modifiers**
  - **Context:** Modifier logic previously knew only regular attribute dice, skill dice, and strain dice.
  - **Decision:** Extend modifier math to support `keyAttributeDice` with removal priority `skill -> regular attribute -> key attribute`, while preserving the existing minimum floor of one total attribute die.
  - **Consequences:** Key attribute die is treated as the last removable attribute die and is effectively protected by the minimum-floor rule in common import scenarios.
  - **Alternatives considered:** Allow modifiers to reduce total attribute dice to zero (rejected to preserve existing floor behavior and avoid breakage in roll assumptions).

- **2026-03-04 — Allow zero regular attribute dice when key attribute die exists**
  - **Context:** Post-modifier counts correctly reduced regular attribute dice to `0` in key-die rolls, but pool sanitization later clamped regular `attributeDice` back to `1`, nullifying the subtraction effect.
  - **Decision:** In pool sanitization, permit `attributeDice` to be `0` whenever `keyAttributeDice > 0`.
  - **Consequences:** Negative modifiers now correctly remove non-key attribute dice while preserving the key die as the final protected die.
  - **Alternatives considered:** Lower attribute minimum globally to `0` (rejected to avoid changing non-key roll assumptions).

- **2026-03-04 — Roll history UI uses local session entries with shared formatting**
  - **Context:** The UI had roll result toasts and hook-level `recentResults`, but no visible history panel after tray results removal.
  - **Decision:** Add a `Roll History` tab in `DicePoolPanel`, feed it from existing local `recentResults`, keep `Clear Dice` from wiping history, and centralize summary wording in `roll-toast-event` with history format `Roll|Push result - X successes, Y banes (with Strain)`.
  - **Consequences:** History and toast wording stay consistent, feature scope remains local-only (remote bridge events still toast-only), and no persistence model changes were introduced.
  - **Alternatives considered:** Include remote bridge events in history or clear history on `Clear Dice` (both rejected to keep scope and behavior aligned with current local session flow).

- **2026-03-05 — Roll results include named roll type only when the source is explicit**
  - **Context:** Toasts and roll history needed to show what was rolled, but the current manual tab stores only numeric dice counts while imported quick-rolls have explicit attribute/skill names at selection time.
  - **Decision:** Add optional `rollTypeLabel` metadata to the local roll request/session/event path, populate it for imported quick-rolls as `Attribute` or `Skill (Attribute)`, preserve it across pushes, and prefix toast/history result text with it when present. Keep manual-tab rolls generic until the UI captures explicit names there.
  - **Consequences:** Named imported rolls and their pushes now produce clearer result text without inventing ambiguous labels for manual rolls; remote integrations can opt into the same output by supplying `rollTypeLabel`.
  - **Alternatives considered:** Infer manual labels from numeric counts (rejected as ambiguous) and change toast titles instead of result text (rejected to preserve current title structure).

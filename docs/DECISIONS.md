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
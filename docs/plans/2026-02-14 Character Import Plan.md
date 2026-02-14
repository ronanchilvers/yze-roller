# Character Import Plan (Dice Pool Tabs)

## Summary
Introduce a new “Import Character” tab inside the Dice Pool panel. This tab accepts a JSON file containing attribute and skill dice, validates it defensively, and allows rolling either an attribute alone or a skill + its associated attribute. The existing Dice Pool behavior remains unchanged in the “Manual” tab. Changes are limited to `src/`.

## Goals
- Import character data from a local JSON file.
- Validate attribute/skill dice counts and skill→attribute relationships.
- Provide a UI to select an attribute or a skill to roll.
- Preserve current Dice Pool behavior in a separate tab.

## Inputs Required (Updated)
- Canonical skill list and skill→attribute mappings come from the provided `skill-mappings.json`.
- Character import schema based on the provided sample character file.
- Import skills based on the mapping keys (only those skills are considered valid).

## Proposed JSON Format (Current sample)
```/dev/null/bessie-collins.json#L1-L30
{
  "firstname": "Bessie",
  "lastname": "Collins",
  "attribute_strength": "1",
  "attribute_agility": "2",
  "attribute_wits": "3",
  "attribute_empathy": "4",
  "skill_hoodwink": "2",
  "skill_notice": "1",
  "skill_physick": "1",
  "skill_pinch": "1",
  "skill_scrap": "1",
  "skill_sneak": "3",
  "skill_streetwise": "2",
  "skill_tinker": "1",
  "skills": "Hoodwink, Sneak, Streetwise"
}
```
Notes:
- Attribute dice come from `attribute_strength`, `attribute_agility`, `attribute_wits`, `attribute_empathy` (all required).
- Skill dice come from `skill_<skillname>` entries; skills are limited to the mapping keys.
- If a skill value is empty or missing, treat it as 0.
- The `skills` comma-separated string is informational; use `skill_*` fields as the source of truth.

## UX Overview
### Dice Pool Panel Tabs
- **Tab A — Manual:** existing behavior (unchanged).
- **Tab B — Import Character:**
  - File input for `.json`
  - Validation feedback (success/error list)
  - Character display name (firstname "nickname" lastname, with sensible fallback)
  - Attribute selector (attribute-only roll)
  - Skill selector (shows associated attribute)

### Empty / Error States
- Invalid JSON → show error with parsing details.
- Missing `attributes` or `skills` → show validation error.
- Skill with missing mapped attribute or missing attribute entry → disable roll and show error.
- No available skills/attributes → show “nothing to roll” message.

## Data Model (In‑State)
- `importedCharacter` (normalized)
  - `name?: string`
  - `attributes: Record<string, number>`
  - `skills: Record<string, number>`
- `selectedAttribute: string | null`
- `selectedSkill: string | null`
- `validation: { isValid: boolean, messages: string[] }`

## Validation & Normalization Rules
- Parse JSON safely; on error, surface message and block import.
- Accept the current schema with `attribute_*` and `skill_*` keys.
- Normalize keys and mapping lookups to a consistent format (trim + lowercase).
- Coerce dice values: numeric strings → numbers; empty string or missing → 0.
- Ignore unknown fields; only read `attribute_*` and `skill_*`.
- Each skill must map to an attribute via the provided mapping.
- Missing skills are not an error; assume a dice count of 0.
- Missing required attributes is an error; cancel the import.
- Attribute dice counts must be integers and at least 1.
- Missing optional identity fields (e.g., `firstname`, `lastname`, `nickname`) should not fail validation.

## Roll Computation
- Attribute-only roll: `attributeDice`
- Skill roll: `attributeDice + skillDice`
- If skill is selected but mapped attribute dice are missing, disable roll.

## Implementation Steps
1. **Locate Dice Pool panel**
   - Identify the component that renders manual dice inputs and the roll action.
2. **Add tab UI**
   - Create a simple tab switcher inside the Dice Pool panel.
   - Ensure manual tab maintains existing state/behavior.
3. **Build import UI**
   - Add file input with `.json` filter.
   - Parse content with `FileReader`.
   - Display validation status and character name.
4. **Normalize & validate**
   - Implement helper (e.g., `normalizeCharacterImport`).
   - Enforce skill→attribute mapping and collect validation messages.
5. **Selection controls**
   - Attribute dropdown from normalized attributes.
   - Skill dropdown from normalized skills; auto-select the mapped attribute when a skill is chosen and show the mapping in the UI.
6. **Integrate roll**
   - Reuse existing roll function and pass computed dice totals.
7. **Accessibility & UI polish**
   - Labels for inputs and dropdowns.
   - Clear errors, disabled button states, and ARIA‑friendly messages.

## Testing Checklist
- Create comprehensive unit tests for each component to validate behavior going forward.
- Invalid JSON → error displayed and roll disabled.
- Missing `attributes` or `skills` → error displayed.
- Skill without mapped attribute → error displayed.
- Valid import → attribute-only roll works.
- Valid import → skill+attribute roll works.
- Switching tabs preserves manual behavior.

## Open Questions
- Dice counts are integers only.
- JSON schemas shown above are canonical for now.
- Ordering/display labels for attributes/skills can be refined later.

## Rollout Notes
- Keep changes in `src/` only.
- No new dependencies.
- Small, focused UI updates.
- Use the project-memory mechanism where appropriate.

## Next Input Needed
Confirm the final JSON schema if it differs from the current sample.

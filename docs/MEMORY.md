# Project Memory

- **Character import utilities** live in `src/lib/character-import.js` (parses JSON, validates required attribute dice, defaults missing skills to 0, builds display name).
- **Canonical skill mappings** live in `src/data/skill-mappings.js` (skill → attribute map used by import flow).
- **Import UI tabs** are implemented in `src/components/DicePoolPanel.jsx` (manual vs import with file input, selectors, and roll/push handling).
- **Import state hook** lives in `src/hooks/useCharacterImport.js` (file loading, validation state, selection state).
- **App integration** wires Dice Pool tabs and roll overrides in `src/App.jsx`.
- **Import summary quick-rolls**: **What** clicking attribute/skill counts triggers rolls with the selected dice. **Where** `src/components/DicePoolPanel.jsx` (`handleSummaryRoll`). **Evidence** summary list items are rendered as buttons that call `handleSummaryRoll`.

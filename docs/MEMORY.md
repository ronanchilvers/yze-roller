# Project Memory

- **Character import utilities** live in `src/lib/character-import.js` (parses JSON, validates required attribute dice, defaults missing skills to 0, builds display name).
- **Canonical skill mappings** live in `src/data/skill-mappings.js` (skill → attribute map used by import flow).
- **Import UI tabs** are implemented in `src/components/DicePoolPanel.jsx` (manual vs import with file input, selectors, and roll/push handling).
- **Import state hook** lives in `src/hooks/useCharacterImport.js` (file loading, validation state, selection state).
- **App integration** wires Dice Pool tabs and roll overrides in `src/App.jsx`.
- **Import summary quick-rolls**: **What** clicking attribute/skill counts triggers rolls with the selected dice. **Where** `src/components/DicePoolPanel.jsx` (`handleSummaryRoll`). **Evidence** summary list items are rendered as buttons that call `handleSummaryRoll`.
- **Full-page dice stage**: **What** the 3D dice canvas is now rendered in a fixed, fullscreen layer behind the UI. **Where** `src/App.jsx` (`dice-stage-fullscreen` wrapper) and `src/App.css` (fullscreen positioning + canvas sizing). **Evidence** the dice tray section was removed and the new wrapper sits above `main` content.

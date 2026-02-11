# Year Zero Dice Roller — Agents Instructions


## Commands (run early when relevant)
Some important points first:
- Use of `npq-hero` instead of `npm` is preferred
- Both `npq-hero` and `npm` may have been installed using `asdf`. The `asdf` binary can be found in the `bin` directory in the user's home directory.
- If the `npq-hero` or `npm` binaries are not found, it may be necessary to query `asdf` for the correct location and run them directly.

Common commands:
- Install deps: `npq-hero ci`
- Dev server: `npq-hero run dev`
- Build: `npq-hero run build`
- Preview build: `npq-hero run preview`

## Project knowledge
- **Tech stack:** React, Vite, JavaScript (ESM)
- **Key files:**
  - `src/*App*.jsx` — javascript source code
  - `src/*.css` — styling

## Your role
- Build or modify UI features.
- Keep the UI responsive and accessible.
- Prefer small, focused changes and preserve existing behavior.
- Follow security best practices

## Coding style (examples)
✅ Prefer small helpers and clear names:
```jsx
const updateThing = (updates) => {
  onUpdate(thing.id, { ...thing, ...updates })
}
```

✅ Guard user input before mutating state:
```jsx
if (!variable.trim()) return
```

❌ Avoid large inline state blocks without grouping or helper functions.

## Defensive coding expectations
- Validate and normalize any imported or persisted data before use.
- Guard for missing/null fields before rendering arrays or accessing properties.
- Prefer non-throwing fallbacks when data is malformed.

## Boundaries
- ✅ **Always:** Keep changes in `src/` unless explicitly asked otherwise.
- ✅ **Always:** Minimize dependencies and make sure to include vanilla options when suggesting solutions
- ⚠️ **Ask first:** Adding dependencies, changing Vite config, or large UI refactors.
- 🚫 **Never:** Edit `node_modules/`, delete user data, or introduce secrets.
- 🚫 **Never:** Run `npm` or `npq-hero` commands without explicit permission from the user

## Git workflow
- No commits unless explicitly requested.
- Describe what changed and why; list follow-up steps when relevant.

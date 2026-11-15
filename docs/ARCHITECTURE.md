# Architecture

- Hosting: GitHub Pages at `/Room-Planner/`; deploy via GitHub Actions from main.
- UI: React TypeScript; 2D SVG; 3D Three.js.
- Canonical model: `schemas/project.schema.json`, mirrored by `src/domain/model.ts`.
- Geometry and validation are independent of React.
- Every floor uses meter units, `vertices -> walls -> room.boundary` graph.
- Door/window: wall-local center distance `offset`, real world `width`, `height`, `sillHeight`.
- Source repo is public; **never commit private apartment plans or credentials**.
- Data repo is user-configurable and should be private. Data path: `projects/<project-id>/project.json`.
- Browser uses user-provided fine-grained PAT only in ephemeral React memory, never URL/localStorage.
- GitHub Contents API PUT uses known SHA; 409/422 means conflict, never force overwrite.
- IndexedDB holds latest unsynced working JSON, and import/export always works without GitHub.
- Future GitHub App login requires a safe code-exchange backend; never embed client secret in Pages.
- On conflict, avoid auto merging architectural geometry. Keep local draft and show a clear warning.

# Contributor Guide

This repository is a static, vanilla JavaScript Conference Assistant scheduler. Preserve the existing architecture and visual design. Make narrow changes, keep business logic in pure modules, and run the full test suite after every behavior change.

## Repository Layout

- `index.html`: shared editor/viewer shell.
- `viewer.html`: static redirect to `index.html?mode=view`.
- `src/main.js`: startup, state ownership, rendering coordination, persistence, and top-level handlers.
- `src/model.js`: defaults, canonical shift types, colors, and JSDoc model definitions.
- `src/scheduleState.js`: immutable schedule mutations and normalization.
- `src/timeUtils.js`, `src/hourCalculations.js`, `src/validation.js`: pure time, total, and warning rules.
- `src/renderSchedule.js`, `src/renderTotals.js`: DOM rendering.
- `src/dragDrop.js`, `src/gridCreate.js`: pointer interactions.
- `src/*Editor.js`, `src/settingsPanel.js`, `src/workerManager.js`: modal workflows.
- `src/jsonHelpers.js`, `src/localStorageAutosave.js`: validated file and browser persistence.
- `src/icsExport.js`: viewer-only calendar snapshot generation.
- `data/published-schedule.json`: schedule viewers see first.
- `data/default-schedule.json`: retained compatibility/archive artifact; not loaded by the application.
- `test/`: Node built-in unit tests for pure business logic.

## Run Locally

Serve this directory through a static server; do not open it with `file://`.

```powershell
python -m http.server 5177 --bind 127.0.0.1
```

Open `http://127.0.0.1:5177/index.html` or `http://127.0.0.1:5177/viewer.html`.

## Run Tests

```powershell
node --test
```

The suite has no runtime dependencies. `npm test` is also available when npm is installed. Run syntax checks and `git diff --check` before completing work.

## Static Deployment Rules

- Keep asset and data paths relative for GitHub Pages project paths.
- Do not introduce server assumptions, secrets, absolute Windows paths, or root-relative URLs.
- Viewer mode must ignore localStorage and load `data/published-schedule.json`, then sample data.
- Editor mode loads valid localStorage first, then published data, and sample data only if the published file is unavailable.
- `published-schedule.json` is manually replaced after an editor exports JSON. It may contain sensitive names and schedule details; obtain approval before public publishing.

## Data Rules

Canonical shift types are: `Check In`, `Check Out`, `Checkout/Project`, `Roving`, `Projects`, `Staff Meeting`, `Desk`, `Class`, `On Call`, `Backup On Call`, `OFF`, and `Other`.

- Store worker references by stable ID, never by name or column index.
- Store roving selections in `roveSubtypes`; normalize legacy `roveSubtype` during import.
- Store Desk Coverage in `deskCoverage`, never as worker shifts.
- An end time less than or equal to its start time means the shift ends the next calendar day.
- Preserve custom labels, notes, and colors. Default-generated values may update only through the established helpers.
- Validate and normalize all imported JSON before replacing current state. Invalid input must not partially apply.
- Keep schema compatibility in `jsonHelpers.js`; update documentation and tests with schema changes.

## Coding Conventions

- Use ES modules, ASCII source unless an existing UI symbol requires Unicode, and DOM `textContent` for imported/user strings.
- Prefer immutable schedule updates through `scheduleState.js`.
- Keep calculations independent from rendering.
- Treat modal HTML templates as static trusted markup; never interpolate imported data into `innerHTML`.
- Null-check optional editor-only DOM controls. Required shell elements should fail with a clear startup error.
- Do not add broad abstractions or refactor large files without a concrete behavior or reliability reason.
- Update `TEST_PLAN.md` for interactions that cannot be covered reliably by unit tests.

## Invariants to Preserve

- Viewer mode is read-only; no create, edit, delete, drag, resize, copy, repeat, settings, import, or autosave.
- Class, OFF, and Desk Coverage never appear in ICS exports.
- ICS exports include counted work, Staff Meeting, and standalone On Call/Backup On Call; notes and phone-coverage details are included.
- Desk Coverage never contributes to worker totals or worker overlap warnings.
- OFF, Class, and standalone phone coverage default to zero counted work hours.
- Weekly calculations split overnight work at actual calendar and displayed-week boundaries.
- Scheduling warnings are non-blocking.
- Missing Night Phone Coverage warnings use only dedicated nightly assignments; never infer them from shifts, phone flags, CSA, or roving subtypes.
- Nightly assignment `notes` is a deprecated import-only field and must not be restored to the editor or exported model.

Read `ARCHITECTURE.md`, `DATA_MODEL.md`, and `CODE_REVIEW.md` before changing cross-module behavior.

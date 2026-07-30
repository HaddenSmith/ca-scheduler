# Conference Assistant Scheduler

A static web app for building Conference Assistant schedules in a Saturday-Friday work week. The app is designed to replace a complicated spreadsheet workflow with a visual schedule board, editable worker columns, hour summaries, warnings, local browser autosave, and JSON import/export.

This is still single-user/local-browser software. There is no backend, Box sync, database, authentication, real-time collaboration, or automatic file locking yet.

## Disclosure

This project was designed and directed by Hadden Smith for the BYU Helaman Halls Conference Assistant scheduling workflow. The implementation code was generated with AI assistance through iterative prompting, testing, and refinement. I provided the product requirements, workflow design, testing feedback, and feature direction. Because the code was AI-generated, it should be reviewed before production or institution-wide deployment. This project is not being presented as hand-coded from scratch.

## Current Features

- Detailed Day View for editing larger day tables.
- Compact Week View for scanning most of the week at once.
- Week navigation with Previous Week, Today, Next Week, and date jump.
- Today scrolls to the current date in Detailed Day View.
- New schedules default to a visible day from 7:00 AM through 2:00 AM; existing schedules retain their saved settings.
- Worker columns under each day, with stable worker IDs.
- Settings panel with schedule, warning, color, worker, and data/backup sections.
- Manage Workers controls for adding, renaming, removing, and drag-reordering workers.
- Click or drag empty grid space to create shifts.
- Click existing shifts to edit, save, delete, copy, or repeat.
- Drag normal shifts between workers, times, and days.
- Shift/Ctrl-drag normal shifts to duplicate them.
- Resize normal shifts from the top or bottom edge.
- Copy shifts to one or more workers.
- Create simple daily or weekly repeated shift copies.
- Multi-select roving subtypes with generated labels and notes.
- Check-In building assignments with structured building metadata and generated labels such as `CI-I`.
- New R-B/R-J and CSA shifts offer editable default times, including Friday-specific overnight times.
- Custom note markers on shift blocks.
- Shift type presets for Check In, Check Out, Checkout/Project, Roving, Projects, Staff Meeting, Desk, Class, On Call, Backup On Call, OFF, and Other.
- Official default colors, editable and resettable in Settings. Changing a default color updates existing default-colored blocks while preserving custom colors.
- Night On Call and Night Backup assignments.
- Also On Call and Also Backup On Call flags on regular shifts.
- Standalone On Call and Backup On Call shift types that do not count toward work hours.
- Desk Coverage rail stored separately from worker shifts.
- Add, edit, delete, drag, resize, duplicate, and repeat Desk Coverage blocks.
- Daily totals, weekly totals, and weekly hours-by-type summary.
- Non-blocking warnings for overlap, phone coverage overlap, missing dedicated Night Phone Coverage, long consecutive work, late-night into early-morning, weekly max hours, daily max hours, and desk coverage gaps.
- JSON export/import for restoring the full local schedule state, available from Settings -> Data / Backup.
- Single-computer localStorage autosave in edit mode.
- Clear Local Autosave and Load Published Schedule controls in Settings -> Data / Backup.
- Static published schedule loading from `data/published-schedule.json`.
- Editor-only notice when published schedule metadata is newer than the local autosave; loading the newer schedule always requires an explicit Settings action.
- Viewer mode with `index.html?mode=view` or `viewer.html`.
- Optional warning display in Viewer Mode, controlled from edit-mode Settings.
- Viewer-only worker calendar download as a one-time `.ics` snapshot.
- Hall Advisor Review Mode with `index.html?mode=ha-review`, using a separate read-only review schedule.

## Edit Mode vs Viewer Mode

Edit mode is the default. It allows creating, editing, dragging, resizing, copying, repeating, importing, exporting, changing settings, and managing workers. The main toolbar stays focused on week navigation, view mode, and Settings; worker and data tools live inside Settings.

Viewer mode is read-only. It loads `data/published-schedule.json` and ignores browser localStorage, so workers see the schedule currently published with the site. It keeps schedule display, week navigation, view switching, totals, shift details, Desk Coverage display, and a worker calendar download. Warnings can be shown or hidden in Viewer Mode with the edit-mode setting.

Hall Advisor Review Mode is read-only. It loads `data/ha-review-schedule.json`, ignores localStorage,
shows shifts, notes, Desk Coverage, and warnings, and keeps week navigation and date jumping. It does not
show calendar download controls.

Open viewer mode with:

```text
index.html?mode=view
```

or open:

```text
viewer.html
```

Use the download icon in Viewer Mode to choose one worker and one week, then download an `.ics` file for Google Calendar, Apple Calendar, Outlook, or another calendar app. Counted work, Staff Meeting, On Call, and Backup On Call shifts are included with notes and phone-coverage details. Class, OFF, and Desk Coverage are always excluded. When a worker has an authoritative nightly assignment, the final exported shift for that night is titled with an `OC /` or `BOC /` prefix. This is a one-time snapshot, not a subscribed calendar. When the published schedule changes, download and import a new file.

## JSON Import and Export

Use **Settings -> Data / Backup -> Export JSON** to download a human-readable schedule file containing workers, shifts, Desk Coverage, nightly on-call assignments, settings, warning settings, colors, current week, schema version, and metadata.

Use **Settings -> Data / Backup -> Import JSON** to validate a selected file before replacing the current in-memory schedule. Invalid files are rejected without destroying the current schedule.

The JSON file represents the whole schedule, not only the visible week.

## Local Autosave

Edit mode autosaves the current schedule to this browser's `localStorage`. On the same computer and browser, reopening the app should restore the local autosave before loading the published schedule.

Local autosave is not a shared backup. It does not sync across computers, browsers, GitHub Pages, Box, or coworkers. Export JSON whenever you need to back up, share, or move the schedule.

Use **Settings -> Data / Backup -> Clear Local Autosave** to remove the saved browser copy. Use **Settings -> Data / Backup -> Load Published Schedule** to replace the current open schedule with `data/published-schedule.json`.

If the app says "Unsaved changes - open Settings -> Data / Backup -> Export JSON," local autosave may already have saved the browser copy, but the schedule has not been exported as a portable file since the last edit.

Published schedule files may include optional `scheduleVersion` and `publishedAt` metadata. Editor mode compares these values with local autosave metadata and never replaces local work automatically.

## Published Schedule

The static schedule shown to workers lives at:

```text
data/published-schedule.json
```

For the current static workflow, a manager/editor exports schedule JSON and Hadden manually replaces `data/published-schedule.json` in GitHub. Viewer Mode loads this file directly and does not read local autosave. Edit mode tries local autosave first, then this published file, then `src/sampleData.js` if the published file is unavailable.

Hall Advisor Review Mode loads `data/ha-review-schedule.json` directly and falls back to sample data if that file is unavailable. It never reads local autosave.

The older `data/default-schedule.json` file is retained as a tracked compatibility/archive artifact, but the application no longer loads it during normal startup or through Settings.

The static schedule files may contain real worker names or shift details. Do not publish them on GitHub Pages unless your workplace has approved sharing that information.

## Local Usage

Because the app uses JavaScript modules, serve the folder with any simple local static server. For example:

```powershell
cd outputs\scheduler-prototype
python -m http.server 5177 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5177/
```

## Automated Tests

The repository uses Node's built-in test runner with no test framework or build system. From this directory, run:

```powershell
node --test
```

`npm test` runs the same command when npm is available. The suite covers ICS generation, time and hour calculations, warnings, JSON compatibility, repeat/copy helpers, and roving utilities. Browser pointer and visual checks remain documented in `TEST_PLAN.md`.

## GitHub Pages Usage

This app is static and should work on GitHub Pages as long as the repository publishes the app folder with these relative paths intact:

- `index.html`
- `viewer.html`
- `src/...`
- `data/published-schedule.json`
- `data/ha-review-schedule.json`

To publish a schedule today, export JSON from Settings -> Data / Backup and replace `data/published-schedule.json` in GitHub. Workers should use `viewer.html` or `index.html?mode=view`. To continue editing on the same computer/browser, local autosave should restore the editor copy. To start fresh, clear local autosave or use Load Published Schedule from Settings -> Data / Backup.

## File Map

- `index.html`: App shell.
- `viewer.html`: Lightweight viewer entry point.
- `data/published-schedule.json`: Static schedule shown in Viewer Mode.
- `data/ha-review-schedule.json`: Static schedule shown in Hall Advisor Review Mode.
- `data/README.md`: Notes about the published schedule and retained compatibility data.
- `src/main.js`: App startup, state wiring, render flow, import/export, and top-level handlers.
- `src/localStorageAutosave.js`: Single-browser local autosave helpers.
- `src/model.js`: Data shapes, settings, shift presets, and color defaults.
- `src/sampleData.js`: Sample workers and shifts.
- `src/scheduleState.js`: Create, copy, update, delete, normalize, and reorder helpers.
- `src/repeatShifts.js`: Simple repeat-copy helpers for shifts and Desk Coverage.
- `src/workerManager.js`: Add, rename, remove, and reorder workers.
- `src/onCallEditor.js`: Edit nightly on-call assignments.
- `src/settingsPanel.js`: Edit local schedule settings.
- `src/renderSchedule.js`: Week/day board rendering.
- `src/dragDrop.js`: Pointer-based drag/drop, duplicate, and resize interactions.
- `src/gridCreate.js`: Empty-grid click and drag-to-create interactions.
- `src/renderTotals.js`: Daily, weekly, and shift-type totals rendering.
- `src/hourCalculations.js`: Scheduled hour math, including week-bounded overnight hour totals.
- `src/validation.js`: Warning rules.
- `src/jsonHelpers.js`: JSON import/export helpers.
- `src/icsExport.js`: Viewer-only worker/week calendar snapshot export.
- `src/shiftEditor.js`: Add/edit/delete normal shift modal.
- `src/deskCoverageEditor.js`: Add/edit/delete Desk Coverage modal.
- `src/timeUtils.js`: Time parsing, normalization, display, and schedule-range helpers.
- `src/styles.css`: Visual styling.

## Current Limitations

- No backend or server-side persistence.
- No Box API or Box folder sync.
- No database.
- No login or authentication.
- No real-time collaboration.
- No automatic locking or conflict prevention.
- No cross-computer sync. Local autosave stays in one browser on one computer.
- No Excel or PDF export yet.
- Calendar downloads are static snapshots and do not update automatically.

## Future Ideas

- Configurable Sunday church time windows, optional warnings, and scheduling rules for repeated missed church attendance.

## Future Work

- Worker statistics and reporting.
- Church attendance scheduling assistance, including configurable Sunday windows and warnings.
- Undo / Redo support.
- Multi-area scheduling with isolated area data and a housing-area selector, such as Helaman, Heritage, Wyview, and Riviera.
- Authentication and backend integration.
- Multi-user editing with conflict prevention.
- Audit history and version history.
- Live/subscribed calendar feeds in addition to snapshot ICS downloads.

Backend, Box storage, locking, and multi-user workflow should be added in later milestones after the local JSON workflow is stable.

# Conference Assistant Scheduler

A static web app for building Conference Assistant schedules in a Saturday-Friday work week. The app is designed to replace a complicated spreadsheet workflow with a visual schedule board, editable worker columns, hour summaries, warnings, local browser autosave, and JSON import/export.

This is still single-user/local-browser software. There is no backend, Box sync, database, authentication, real-time collaboration, or automatic file locking yet.

## Current Features

- Detailed Day View for editing larger day tables.
- Compact Week View for scanning most of the week at once.
- Week navigation with Previous Week, Today, and Next Week.
- Today scrolls to the current date in Detailed Day View.
- Worker columns under each day, with stable worker IDs.
- Manage Workers modal for adding, renaming, removing, and drag-reordering workers.
- Click or drag empty grid space to create shifts.
- Click existing shifts to edit, save, delete, copy, or repeat.
- Drag normal shifts between workers, times, and days.
- Shift/Ctrl-drag normal shifts to duplicate them.
- Resize normal shifts from the top or bottom edge.
- Copy shifts to one or more workers.
- Create simple daily or weekly repeated shift copies.
- Multi-select roving subtypes with generated labels and notes.
- Custom note markers on shift blocks.
- Shift type presets for Check In, Check Out, Roving, Projects, Staff Meeting, Desk, Class, On Call, Backup On Call, OFF, and Other.
- Official default colors, editable in Settings.
- Night On Call and Night Backup assignments.
- Also On Call and Also Backup On Call flags on regular shifts.
- Standalone On Call and Backup On Call shift types that do not count toward work hours.
- Desk Coverage rail stored separately from worker shifts.
- Add, edit, delete, drag, resize, duplicate, and repeat Desk Coverage blocks.
- Daily totals, weekly totals, and weekly hours-by-type summary.
- Non-blocking warnings for overlap, phone coverage overlap, long consecutive work, late-night into early-morning, weekly max hours, and daily max hours.
- JSON export/import for restoring the full local schedule state.
- Single-computer localStorage autosave in edit mode.
- Clear Local Autosave and Load Default Schedule controls.
- Static default schedule loading from `data/default-schedule.json`.
- Viewer mode with `index.html?mode=view` or `viewer.html`.

## Edit Mode vs Viewer Mode

Edit mode is the default. It allows creating, editing, dragging, resizing, copying, repeating, importing, exporting, changing settings, and managing workers.

Viewer mode is read-only. It keeps schedule display, week navigation, view switching, warnings, totals, shift details, and Desk Coverage display, but hides or disables editing controls.

Open viewer mode with:

```text
index.html?mode=view
```

or open:

```text
viewer.html
```

## JSON Import and Export

Export JSON downloads a human-readable schedule file containing workers, shifts, Desk Coverage, nightly on-call assignments, settings, warning settings, colors, current week, schema version, and metadata.

Import JSON validates the selected file before replacing the current in-memory schedule. Invalid files are rejected without destroying the current schedule.

The JSON file represents the whole schedule, not only the visible week.

## Local Autosave

Edit mode autosaves the current schedule to this browser's `localStorage`. On the same computer and browser, reopening the app should restore the local autosave before loading the default schedule.

Local autosave is not a shared backup. It does not sync across computers, browsers, GitHub Pages, Box, or coworkers. Export JSON whenever you need to back up, share, or move the schedule.

Use **Clear Local Autosave** to remove the saved browser copy. Use **Load Default Schedule** to replace the current open schedule with `data/default-schedule.json`.

If the app says “Unsaved changes - export JSON for backup,” local autosave may already have saved the browser copy, but the schedule has not been exported as a portable file since the last edit.

## Default Schedule

The static default file lives at:

```text
data/default-schedule.json
```

On first load, the app tries local autosave first. If there is no local autosave, it fetches this default JSON file. If the file is missing or invalid, the app falls back to `src/sampleData.js`.

The default schedule file may contain real worker names or shift details. Do not publish it publicly on GitHub Pages unless your workplace has approved sharing that information.

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

## GitHub Pages Usage

This app is static and should work on GitHub Pages as long as the repository publishes the app folder with these relative paths intact:

- `index.html`
- `viewer.html`
- `src/...`
- `data/default-schedule.json`

To share a schedule today, export JSON and upload or send the exported file. To continue on the same computer/browser later, local autosave should restore the last browser copy. To start fresh, clear local autosave or load the default schedule.

## File Map

- `index.html`: App shell.
- `viewer.html`: Lightweight viewer entry point.
- `data/default-schedule.json`: Static default schedule used when no local autosave exists.
- `data/README.md`: Notes about default schedule data.
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
- `src/hourCalculations.js`: Scheduled hour math.
- `src/validation.js`: Warning rules.
- `src/jsonHelpers.js`: JSON import/export helpers.
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

Backend, Box storage, locking, and multi-user workflow should be added in later milestones after the local JSON workflow is stable.

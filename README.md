# Conference Assistant Scheduler Prototype

Milestone 1 is a local-only HTML/CSS/JavaScript prototype. It uses ES modules, sample data, and in-memory schedule objects.

## Current Features

- Saturday-Friday week view.
- Previous Week, Next Week, and Today week navigation.
- Detailed Day View and Compact Week View layout toggle.
- Settings panel for time increment, visible day range, week start day, and default shift colors.
- Worker columns inside each day.
- 7:00 AM to 1:00 AM schedule range.
- 15-minute visual grid.
- Night On Call / Night Backup row.
- Colored sample shift blocks.
- Click existing shifts to edit.
- Drag shifts between workers, days, and times.
- Hold Shift or Ctrl while dragging a shift to duplicate it instead of moving it.
- Resize shifts from the top or bottom edge.
- Add shifts from each day header.
- Click empty calendar space to start a prefilled shift.
- Drag on empty calendar space to select a draft time range before adding a shift.
- Copy an edited shift to one or more workers.
- Create simple daily or weekly repeated shift copies.
- Type times manually while still getting 15-minute time suggestions.
- Show editable time suggestions in 12-hour format while storing clean `HH:mm` values.
- Manage workers with stable worker IDs.
- Edit nightly primary and backup on-call assignments by day.
- Add roving subtypes and placeholder subtype notes.
- Mark a shift as also on call or also backup on call for that shift's time range.
- Show non-blocking warnings when primary or backup phone coverage overlaps.
- Save, cancel, and delete shifts in a modal.
- Shift type presets for Check In, Check Out, Roving, Projects, Staff Meeting, Desk, Class, On Call, Backup On Call, OFF, and Other.
- Official default colors for the main shift types.
- Non-blocking overlap warnings.
- Daily totals per worker.
- Weekly totals per worker at the bottom of the page.
- Separate hour calculation logic.

## File Map

- `index.html`: App shell.
- `src/main.js`: App startup and wiring.
- `src/model.js`: Data shapes, settings, label defaults.
- `src/sampleData.js`: Sample workers and shifts.
- `src/scheduleState.js`: Create, update, delete, and normalize shifts.
- `src/repeatShifts.js`: Simple daily/weekly repeat-copy helpers.
- `src/workerManager.js`: Add, rename, and remove workers.
- `src/onCallEditor.js`: Edit primary and backup on-call assignments.
- `src/settingsPanel.js`: Edit local in-memory schedule settings.
- `src/renderSchedule.js`: Week/day board rendering.
- `src/dragDrop.js`: Pointer-based shift drag/drop and resize interactions.
- `src/gridCreate.js`: Empty-grid click and drag-to-create interactions.
- `src/renderTotals.js`: Daily and weekly totals rendering.
- `src/hourCalculations.js`: Scheduled hour math.
- `src/validation.js`: Warning rules.
- `src/jsonHelpers.js`: JSON import/export helpers.
- `src/shiftEditor.js`: Add/edit/delete shift modal.
- `src/timeUtils.js`: Time parsing, normalization, display, and schedule-range helpers.
- `src/styles.css`: Visual styling.

## Next Milestone

Add JSON import/export controls so real schedules can be saved and restored.

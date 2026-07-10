# Conference Assistant Scheduler Test Plan

Use this checklist before moving toward backend, Box, or server work.

## General Smoke Tests

- Load edit mode at `/` and confirm there are no console errors.
- Load viewer mode at `/index.html?mode=view` and confirm editing controls are hidden.
- Load `viewer.html` and confirm it opens viewer mode.
- Confirm GitHub Pages/static paths work with relative `index.html`, `viewer.html`, `src/...`, and `data/default-schedule.json`.
- Switch between Detailed Day View and Compact Week View.
- Use Previous Week, Next Week, and Today.
- In Detailed Day View, click Today and confirm the page scrolls to today's day section.
- Open Settings, change a harmless setting, save, and confirm the schedule re-renders.
- Confirm the main toolbar only shows Previous Week, Today, Next Week, Detailed Day View, Compact Week View, and Settings.
- Confirm the toolbar remains compact on desktop and stacks cleanly on narrow screens.
- Confirm Manage Workers, Import JSON, Export JSON, Clear Local Autosave, and Load Default Schedule are available from Settings instead of the main toolbar.
- Change a shift color default in Settings and confirm existing default-colored shifts update.
- Change a shift color default in Settings and confirm custom-colored shifts are preserved.
- Confirm Detailed Day View is usable with around 12 workers plus Desk Coverage on a normal desktop screen.
- Confirm too-small screens scroll horizontally instead of making worker columns unreadable.

## Local Autosave and Default Data

- Open the app in edit mode with empty localStorage and confirm `data/default-schedule.json` loads.
- Confirm the default schedule has 12 workers and realistic multi-week schedule data.
- Confirm the default schedule uses clean labels such as Check In, Check Out, Desk, Projects, Staff Meeting, Class, OFF, On Call, Backup On Call, and roving subtype labels.
- Make a small edit and confirm the local save status updates.
- Refresh the page and confirm the edit restores from local autosave.
- Confirm the app shows "Unsaved changes - open Settings -> Data / Backup -> Export JSON" after an edit.
- Export JSON from Settings -> Data / Backup and confirm the unsaved/export reminder clears or softens.
- Import valid JSON from Settings -> Data / Backup and confirm the unsaved/export reminder clears until the next edit.
- Try refreshing/closing after an unexported edit and confirm the browser warns before leaving.
- Use Clear Local Autosave from Settings -> Data / Backup, confirm the warning prompt appears, and confirm the current open schedule stays visible.
- Refresh after clearing local autosave and confirm the default schedule loads again.
- Use Load Default Schedule from Settings -> Data / Backup, confirm the warning prompt appears, and confirm current in-memory/local schedule is replaced.
- Temporarily remove or rename `data/default-schedule.json` during local testing and confirm sample data loads gracefully.

## JSON

- Export JSON from Settings and confirm the downloaded file is readable.
- Import that valid JSON from Settings and confirm workers, shifts, Desk Coverage, settings, warnings, colors, and current week restore.
- Try importing invalid JSON and confirm the current schedule is not replaced.
- Import older JSON without newer fields and confirm defaults are filled safely.
- Confirm `deskCoverage`, `roveSubtypes`, warning settings, `viewerWarningsEnabled`, and worker order survive JSON round trip.
- Confirm viewer mode still works after importing JSON in edit mode.
- Confirm local autosave restores the imported schedule after refresh.
- Confirm older JSON without `viewerWarningsEnabled` imports with Viewer Mode warnings enabled by default.

## Normal Shifts

- Add a shift from the Add Shift button.
- Click empty grid space to create a shift.
- Drag empty grid space to create a shift.
- Click an existing shift to edit it.
- Save, cancel, and delete shifts.
- Drag a shift to a different worker.
- Drag a shift to a different time.
- Drag a shift to a different day.
- Resize a shift from the top edge.
- Resize a shift from the bottom edge.
- Shift/Ctrl-drag a shift to duplicate it.
- Use Copy to Workers while editing an existing shift.
- Use Copy to Workers while creating a new shift.
- Create repeated normal shifts.
- Confirm custom labels are preserved.
- Confirm changing shift type updates default labels only when appropriate.
- Confirm compact/cramped blocks show abbreviations for default labels without changing the saved label.
- Confirm custom note markers appear only for custom notes.
- Confirm On Call and Backup On Call shift types hide the extra Also On Call / Also Backup On Call checkboxes.
- Confirm normal working shift types still show both phone coverage checkboxes.

## Roving

- Select one roving subtype and confirm the label and notes populate.
- Select multiple roving subtypes and confirm combined labels and notes.
- Edit roving notes manually and confirm they are not overwritten.
- Switch away from Roving and confirm only auto-generated roving notes are cleared.

## Warnings

- Trigger and verify normal shift overlap warnings.
- Trigger and verify phone/on-call overlap warnings.
- Trigger and verify long consecutive work warnings.
- Trigger and verify late-night into early-morning warnings.
- Trigger and verify weekly max hours warnings.
- Trigger and verify daily max hours warnings.
- Disable each warning setting and confirm the matching warning hides.
- In edit mode, confirm warnings show normally.
- In viewer mode, confirm warnings show when "Show warnings in Viewer Mode" is enabled.
- In viewer mode, confirm warnings hide when "Show warnings in Viewer Mode" is disabled in the saved schedule.

## Totals

- Confirm daily totals update after create, edit, delete, drag, and resize.
- Confirm weekly totals update after create, edit, delete, drag, and resize.
- Confirm weekly hours-by-type updates.
- Confirm standalone On Call and Backup On Call do not count toward total work hours.
- Confirm Desk Coverage does not count toward worker totals.
- Confirm Staff Meeting counts toward hours.
- Confirm Class and OFF do not count toward hours.

## Workers

- Add a worker and confirm they appear in schedule columns and totals.
- Rename a worker and confirm existing shifts remain attached.
- Remove a worker with no shifts.
- Try removing a worker with shifts and confirm removal is blocked.
- Drag workers in Manage Workers to reorder them.
- Save and confirm schedule columns, totals, JSON export/import, and viewer mode use the new order.
- Confirm 12 workers plus Desk Coverage remain readable in Detailed Day View.

## Desk Coverage

- Add Desk Coverage from the Add Desk button.
- Click empty Desk Coverage rail space to create a block.
- Drag empty Desk Coverage rail space to create a block.
- Click a Desk Coverage block to edit it.
- Delete a Desk Coverage block.
- Drag a Desk Coverage block to move it.
- Resize Desk Coverage from the top edge.
- Resize Desk Coverage from the bottom edge.
- Shift/Ctrl-drag Desk Coverage to duplicate it.
- Create repeated Desk Coverage blocks.
- Confirm Desk Coverage survives JSON export/import.
- Confirm Desk Coverage is visible but not editable in viewer mode.
- Confirm Desk Coverage text is readable in the narrow rail.

## Scroll Preservation

- In Compact Week View, horizontally scroll a day card to the right, edit or add a block, save, and confirm the scroll position is preserved.
- Repeat the same in Detailed Day View.
- Drag or resize a block while scrolled right and confirm the horizontal scroll position is preserved.
- Confirm Previous Week and Next Week may reset horizontal scroll.

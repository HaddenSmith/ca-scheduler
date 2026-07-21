# Architecture

## System Shape

The scheduler is a static browser application built with HTML, CSS, and native ES modules. There is no server, authentication layer, database, or shared concurrency model.

```text
index.html
   |
   v
main.js ---- startup data sources
   |          editor: localStorage -> published JSON -> sample data
   |          viewer: published JSON -> sample data
   |
   +--> immutable schedule state
   |       scheduleState.js / repeatShifts.js
   |
   +--> calculations and warnings
   |       timeUtils.js -> hourCalculations.js / validation.js
   |
   +--> render
   |       renderSchedule.js / renderTotals.js
   |
   +--> browser interactions
           editors / settings / dragDrop.js / gridCreate.js
```

## Startup

`main.js` determines viewer mode from the query string. `viewer.html` redirects to the same shell with `?mode=view`, so there is only one application to maintain.

Editor loading order:

1. Validate and restore local browser autosave.
2. Fetch and validate `data/published-schedule.json`.
3. Fall back to normalized in-code sample data.

Viewer loading order:

1. Fetch and validate `data/published-schedule.json`.
2. Fall back to normalized in-code sample data.

Viewer mode intentionally does not read or write localStorage.

## State and Rendering

`main.js` owns the current schedule, view mode, read-only flag, dirty/export state, and transient UI status. Feature modules receive the current schedule and return a result or a new schedule; they do not own a second schedule store.

```text
user action
  -> editor/interaction callback
  -> scheduleState immutable helper
  -> commitScheduleChange
  -> editor localStorage autosave
  -> recalculate totals and warnings
  -> replace schedule DOM
  -> restore applicable scroll positions
```

Normal edits use immutable top-level arrays and stable record IDs. Renderers rebuild the visible board rather than patching individual blocks. This is straightforward and reliable at the current data size.

## Time and Totals

Times are stored as `HH:MM` local wall-clock values. An end time less than or equal to the start is interpreted as the next day. `splitShiftIntoCalendarSegments` creates actual calendar-day pieces; week calculations filter those segments against the displayed seven-day boundary. This prevents last-night after-midnight hours from being counted in both weeks.

Daily totals, weekly totals, and hours-by-type are pure calculations. `countsTowardHours` determines counted work. Standalone On Call, Backup On Call, Class, and OFF normally have zero counted hours.

## Warnings

`validation.js` contains non-blocking rules for worker overlap, phone-role overlap, daily/weekly maximums, long consecutive work, late-to-early turnaround, and Desk Coverage gaps. `main.js` scopes them to the displayed week and renders grouped, collapsible messages. Viewer warnings obey `settings.viewerWarningsEnabled`.

## Desk Coverage

Desk Coverage is a separate record collection with no worker ID. It has its own editor and drag/resize path and participates only in desk-gap coverage analysis. It is deliberately excluded from worker totals, worker overlap checks, and ICS files.

## Check-In Building Assignments

Check-In shifts optionally store `checkInBuilding` and the normalized `checkInCode`. The shift editor
uses the ordered building list in `checkInUtils.js` and generates labels such as `CI-I` when the
label is still default-generated. Existing Check-In shifts without building metadata remain valid;
custom labels are preserved. Rendering and ICS export use the resulting stored label and do not parse
building assignments from display text.

## Persistence

`jsonHelpers.js` owns the schedule-file envelope, schema validation, defaults, and legacy normalization. Import validates the complete candidate before state replacement. Export includes the complete multi-week schedule, settings, worker order, nightly assignments, and Desk Coverage.

`localStorageAutosave.js` stores the same normalized file shape plus dirty/export metadata. Storage operations are caught so quota or browser restrictions produce a user-facing error instead of crashing the app. This is single-browser convenience storage, not backup or synchronization.

## ICS Generation

`icsExport.js` creates a client-side RFC 5545 snapshot for one worker and one selected week. It includes counted work, Staff Meeting, standalone On Call, and standalone Backup On Call. It always excludes Class, OFF, and Desk Coverage. Notes and shift phone roles are included.

Nightly on-call assignments are represented in ICS by prefixing the selected worker's final exported
shift of that date with `OC /` or `BOC /`. No separate reminder events are generated. Calendar lines
use CRLF, UTF-8 75-octet folding, `America/Denver`, stable UIDs, and escaped TEXT values.

## Viewer Restrictions

Viewer mode hides editor/admin controls and renderers attach details-only click handlers. Grid creation, drag/drop, resize, worker management, settings, JSON tools, and autosave are not enabled. This is a UI restriction, not authentication; static JSON remains downloadable by anyone who can access the site.

## GitHub Pages

All runtime paths are relative. Publishing must preserve `index.html`, `viewer.html`, `src/`, and `data/` together. The current publishing process is manual: export JSON, review it, and replace `data/published-schedule.json` in the deployed repository.

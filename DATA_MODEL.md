# Data Model

The persisted format is a versioned JSON envelope. The current `schemaVersion` is `1` and the app identifier is `conference-scheduler`.

## Envelope

```js
{
  schemaVersion: 1,
  app: "conference-scheduler",
  exportedAt: "ISO timestamp",
  lastModifiedAt: "ISO timestamp",
  revision: 1,
  data: {
    workers: [],
    shifts: [],
    deskCoverage: [],
    onCallAssignments: [],
    settings: {},
    currentWeekStart: "YYYY-MM-DD"
  }
}
```

`revision` is metadata for future synchronization; it is not currently a lock or conflict detector.

## Worker

```js
{ id: "worker-stable-id", name: "Visible Name" }
```

Array order is schedule column and summary order. Renaming or reordering never changes shift ownership because shifts reference `id`.

## Shift

```js
{
  id: "shift-unique-id",
  workerId: "worker-stable-id",
  date: "YYYY-MM-DD",
  startTime: "HH:MM",
  endTime: "HH:MM",
  name: "Desk",
  shiftType: "Desk",
  label: "Desk",
  notes: "",
  color: "#2bcaca",
  countsTowardHours: true,
  roveSubtype: "",       // legacy/primary compatibility value
  roveSubtypes: [],       // canonical roving selections
  alsoOnCall: false,
  alsoBackupOnCall: false
}
```

Canonical `shiftType` values are `Check In`, `Check Out`, `Checkout/Project`, `Roving`, `Projects`, `Staff Meeting`, `Desk`, `Class`, `On Call`, `Backup On Call`, `OFF`, and `Other`.

Roving values normalize to `R-1` through `R-10`, `R-B`, `R-J`, and `CSA`. Older imports containing only `roveSubtype` are migrated to `roveSubtypes`.

Default labels and colors come from settings/presets. Custom values are stored directly. UI abbreviation changes display only and does not mutate stored labels. Generated roving descriptions can be distinguished from custom manager notes.

## Desk Coverage

```js
{
  id: "desk-coverage-unique-id",
  date: "YYYY-MM-DD",
  startTime: "HH:MM",
  endTime: "HH:MM",
  label: "D",
  notes: "",
  color: "#a6a6a6"
}
```

Desk Coverage has no worker and is excluded from worker hours, worker overlaps, and ICS export.

## Nightly Phone Assignment

```js
{
  date: "YYYY-MM-DD",
  primaryWorkerId: "worker-id-or-empty",
  backupWorkerId: "worker-id-or-empty"
}
```

Time-based phone coverage can also be represented on shifts with `alsoOnCall` and `alsoBackupOnCall`, or by standalone On Call/Backup On Call shifts.

Older schedule files may contain a `notes` field on nightly assignments. That field is deprecated: imports accept and ignore it, and normalized/autosaved/exported records omit it. This does not affect notes on normal shifts, roving shifts, or Desk Coverage.

## Settings

Settings include:

- visible start/end time, time increment, and week-start weekday;
- per-type default colors, including Desk Coverage;
- viewer warning visibility;
- daily/weekly maximum hour warnings;
- long consecutive work and required-break thresholds;
- late-night/early-morning thresholds;
- required Desk Coverage window and warning toggle.
- missing dedicated Night Phone Coverage warning toggle.

Import merges missing optional settings with `DEFAULT_SETTINGS`. Older files without a Checkout/Project color inherit the imported Check Out color.

## Overnight and Week Boundaries

Dates identify the shift's starting calendar day. If `endTime <= startTime`, the end is on the following calendar day. Calculations split such shifts into calendar-day segments and then include only segments inside the requested week. The shift may still render as one visual block on its starting day.

## Static Schedule Files

- `data/published-schedule.json`: canonical source for viewers and static fallback for editors.
- `data/default-schedule.json`: retained compatibility/archive artifact and not part of normal runtime loading.

The retained archive uses the same validated envelope as imports and exports. Viewer mode ignores localStorage; editor mode prefers a valid local autosave, then the published file.

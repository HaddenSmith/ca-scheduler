# Conservative Code Review

Review date: 2026-07-13. Scope: static single-user manager trial and preparation for future BYU IT review.

## Critical

No critical defect was found for the current single-computer trial workflow.

The viewer is not a security boundary. Anyone who can access the GitHub Pages site can fetch its published JSON. Do not publish protected or unapproved personal schedule data.

## Important Before Backend Migration

### Authentication and authorization

- Module: deployment/application boundary
- Issue: viewer/editor separation is controlled in the browser and has no authenticated server enforcement.
- Risk: users can inspect static data or load edit mode; there is no protected write API only because no server exists.
- Future action: use BYU-approved authentication and enforce roles server-side before shared production use.

### Conflict and audit model

- Module: `main.js`, `jsonHelpers.js`, `localStorageAutosave.js`
- Issue: revision metadata is informational; there is no compare-and-swap, lock, audit history, or multi-user merge.
- Risk: independently exported schedules can overwrite one another when manually published.
- Future action: design server transactions, optimistic concurrency, revision history, and audit ownership before multi-user editing.

### Schema evolution

- Module: `jsonHelpers.js`
- Issue: only schema version 1 is accepted; compatibility is handled through field defaults rather than explicit version migrations.
- Risk: backend or future schema changes could make historical exports unusable without a planned migration path.
- Future action: add tested version-to-version migration functions and retain fixture files for every supported version.

### Privacy review

- Module: `data/published-schedule.json`, GitHub Pages deployment
- Issue: published schedule data is a directly downloadable static asset.
- Risk: worker names, availability, notes, or assignments may be exposed beyond the intended audience.
- Future action: have BYU IT/data governance approve hosting, access control, retention, and note content.

## Maintainability Improvements

### Large application coordinator

- Module: `main.js`
- Issue: startup, render coordination, persistence, warning presentation, import/export, and most top-level workflows share one large module.
- Risk: cross-feature changes have a growing regression surface.
- Future action: during backend work, extract an application service/state controller and separate startup/persistence adapters incrementally, backed by integration tests.

### Modal module state

- Modules: `shiftEditor.js`, `deskCoverageEditor.js`, `settingsPanel.js`, `icsExport.js`, other modal modules
- Issue: singleton module variables hold active context and promise resolvers.
- Risk: simultaneous or reentrant modal calls need careful cancellation and complicate isolated DOM tests.
- Future action: consider modal controller instances only when adding a formal UI test harness or concurrent workflows.

### Render-time schedule scans

- Module: `renderSchedule.js`
- Issue: each worker/day column filters the full shifts array.
- Risk: performance scales poorly for much larger multi-area or multi-year in-memory datasets.
- Future action: introduce date/worker indexes at the selector layer when profiling shows a need; do not preemptively complicate the current 481-shift schedule.

### Historical timezone rules

- Module: `icsExport.js`
- Issue: the embedded America/Denver rules model modern US DST recurrence (2007 onward).
- Risk: exports for historical dates before the modern DST rules may be interpreted one hour off by some calendar clients.
- Future action: use a reviewed timezone-generation strategy if historical calendar exports become a firm requirement.

### Accessibility depth

- Modules: modal and pointer interaction modules
- Issue: controls have labels and Escape handling, but modals do not implement a complete focus trap/return-focus system; drag/resize is pointer-oriented.
- Risk: keyboard-only and assistive-technology workflows may be incomplete.
- Future action: conduct an accessibility review and add keyboard equivalents before institution-wide deployment.

## Optional Polish

- Add browser integration tests for modal focus, viewer restrictions, and pointer workflows when a stable CI browser environment is available.
- Move repeated modal construction patterns into a small shared utility only after behavior is covered; avoid a cosmetic rewrite.
- Consider displaying the published file's export timestamp/revision in Viewer Mode.

## Reliability Findings Addressed in This Review

- ICS filtering now uses canonical types and always excludes Class, OFF, and Desk Coverage.
- ICS event UIDs now remain stable when a shift date changes.
- Optional nightly reminders deduplicate explicit phone assignments and never infer status from CSA labels.
- Normal and phone overlap warnings now detect intersections split across midnight calendar days.
- Displayed-week overlap analysis now includes shifts starting the prior day and filters results back to visible dates.
- Pure business logic now has a lightweight automated regression suite.

## Safety Notes

Imported labels and notes are rendered with `textContent`; inspected uses of `innerHTML` are static templates rather than interpolated schedule data. localStorage operations already catch browser/quota failures. No circular ES-module dependency was found. Static runtime paths are relative and compatible with a GitHub Pages project path.

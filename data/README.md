# Static Schedule Data

`published-schedule.json` is the temporary static schedule shown to workers in Viewer Mode. To publish an updated schedule without a backend, export JSON from edit mode and replace this file in GitHub.

`default-schedule.json` is fallback/sample data. Viewer Mode uses it only when the published file is unavailable or invalid. Edit mode uses local browser autosave first, then the published file, then this fallback file.

Both files use the same validated schedule JSON format. Future Box, backend, or shared-storage work can replace these static sources without changing the core schedule model.

Do not publish real worker names or schedule details publicly unless your workplace has approved it.

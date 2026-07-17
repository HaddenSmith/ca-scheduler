# Static Schedule Data

`published-schedule.json` is the canonical static schedule shown to workers in Viewer Mode and used as the editor's static starting point. To publish an updated schedule without a backend, export JSON from edit mode and replace this file in GitHub.

`default-schedule.json` is retained as an older compatibility/archive artifact. The application no longer loads it during normal startup or through Settings; if the published file is unavailable, it falls back directly to in-code sample data.

Both files use the same validated schedule JSON format. Future Box, backend, or shared-storage work can replace these static sources without changing the core schedule model.

Do not publish real worker names or schedule details publicly unless your workplace has approved it.

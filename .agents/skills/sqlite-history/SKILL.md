---
name: sqlite-history
description: Use when touching downloads.db — schema design, queue restoration across restarts, download history queries, filter by date/platform, or "Open in Folder" lookups. Covers FR-5.1, FR-5.2.
---

# SQLite History & Queue Persistence

## When to use
Schema migrations, queue-restore-on-launch logic, or history UI queries
(filter/sort/open-folder).

## Schema shape
Keep it to two tables to start — resist the urge to over-normalize before
there's a second feature that needs it:

- `tasks`: `id (uuid)`, `url`, `title`, `platform`, `status`, `output_path`,
  `format_selection (json)`, `created_at`, `completed_at`
- `task_events` (optional, only if you want a scrubbable progress history
  per task rather than just latest state): `task_id`, `percent`, `speed`,
  `ts` — otherwise just store latest snapshot fields directly on `tasks`
  and skip this table for the MVP.

## Queue restoration (part of FR-5.1)
On app launch, query `tasks WHERE status IN ('queued','downloading',
'muxing')`. These are tasks that were interrupted by an app close/crash.
Do NOT silently auto-resume them — surface them in the UI as "Interrupted —
Resume?" and let the user confirm, since network conditions or the target
video's availability may have changed since last session.

## History view (FR-5.2)
- Filter by date range and by `platform` column (derive platform from the
  URL's domain at task-creation time, don't re-parse it every query).
- "Open in Folder" should use Tauri's `shell::open` targeting the parent
  directory of `output_path`, and must handle the case where the file was
  since moved/deleted — check existence first and show a clear "file no
  longer found" state rather than a silent no-op or raw OS error.

## Migration hygiene
Use `rusqlite_migration` (or hand-rolled versioned migration files) from
the very first commit that touches the schema — retrofitting migrations
onto a schema-less SQLite file later is painful and this project will add
columns (SponsorBlock settings, subtitle prefs) in Phase 2.

---
name: scheduler-and-rules
description: Use when building or touching download scheduling (start-at-a-future-time), rule-based auto-routing (destination folder/quality by source pattern), queue priority/reordering, or global bandwidth throttling. These four features are grouped because they all modify how/when tasks in the queue execute, sharing one settings surface and one execution-decision function in the Rust backend.
---

# Scheduler, Routing Rules, Queue Priority & Throttling

## Why these four are one skill
They all answer the same underlying question the queue's execution loop
asks about every task: "should this run right now, and if so, with what
settings, at what rate?" Building them as four disconnected features
invites four disconnected, inconsistent UI patterns. Build one
`should_execute_now(task) -> ExecutionDecision` function in Rust that all
four feed into, and one Settings > Automation panel in the frontend that
surfaces all four together.

## 1. Scheduling (start-at-a-future-time)
- A task can be created with an optional `scheduled_for: DateTime` field
  in SQLite. If present, its initial status is `scheduled` (see the
  status-model skill — already added), not `queued`.
- A lightweight background timer (check every 30-60s, not a busy loop —
  this is a batch app, not a real-time system) promotes any `scheduled`
  task whose time has arrived to `queued`, at which point the normal
  execution loop picks it up.
- Support both "one-off" (single task) and "recurring window" (e.g. "only
  download between 1am-6am") scheduling. The recurring case is really a
  **throttle/permission window**, not a per-task timestamp — model it
  separately as a global setting (`quiet_hours: { start, end, enabled }`)
  that the execution decision checks, rather than stamping every task
  with a repeating schedule. Keep the two concepts distinct in the data
  model even though the UI can present them together.
- Edge case: if the app isn't running when a scheduled time arrives, the
  task must promote to `queued` on next launch if its time has already
  passed — don't silently skip it or leave it stuck at `scheduled`
  forever. Check this on every app start, not just via the timer.

## 2. Rule-based routing (your USP over IDM's flat folder-by-type)
IDM sorts by file extension into fixed folders. Do this better: rules are
pattern-matched against the *source*, not just the file type.

**Rule schema** (see `references/rules-schema.md` for the full JSON
shape): a rule has a `match` (domain, channel/uploader name, or URL
pattern) and an `action` (destination folder, default quality/format,
optional auto-start vs. always-ask). Rules are evaluated in the order the
user defined them (first match wins) with an implicit catch-all default
rule at the end — never leave a task with no matching rule and no
fallback.

- Apply rules automatically the moment metadata is fetched (channel name
  is known right after `fetch_metadata` returns), not after the user
  manually picks options — the whole point is reducing manual steps
  per download.
- Always show which rule fired (a small "Auto-routed via rule: <name>"
  label on the download card) — invisible automation that silently
  changes where a file lands is the kind of thing that erodes trust fast;
  visible automation with a one-click "override this once" affordance is
  the right balance.
- Rule editing lives in Settings, with a simple three-field form (match
  type + match value + action) — resist the urge to build a full regex
  editor for v1; a handful of match types (domain equals, channel-name
  contains, URL contains) covers the real use cases people actually ask
  for.

## 3. Queue priority / reordering
- Tasks in `queued` state are orderable via drag-and-drop in the
  frontend; persist the order as an integer `queue_position` column in
  SQLite so it survives restarts.
- A global `max_concurrent_downloads` setting (default 2-3, user
  configurable) governs how many `queued` tasks the execution loop
  promotes to `starting` at once — this is separate from a single
  download's internal `--split`/`--concurrent-fragments` connection
  count (per-file parallelism) vs. this setting (across-file
  parallelism). Don't conflate the two in the UI or the code — label
  them distinctly ("Simultaneous downloads" vs. a file's own connection
  count, which the user doesn't need to see per-task at all).
- Reordering only affects `queued` tasks waiting to start — don't let a
  drag operation attempt to reorder something already `downloading`;
  disable dragging on in-progress rows.

## 4. Global bandwidth throttling
- One setting: an optional max total speed (e.g. "Limit to 5 MB/s"),
  applied across all active tasks combined, not per-task. For the
  direct-link engine (aria2c), this maps directly to aria2c's
  `--max-overall-download-limit` flag. For yt-dlp, use `--limit-rate`,
  but note it's a **per-process** limit in yt-dlp — if multiple yt-dlp
  tasks run concurrently, divide the global limit by
  `max_concurrent_downloads` and apply that per-process, recalculating
  whenever the concurrency setting changes.
- Quiet-hours (from the scheduling section) can carry its own, separate,
  stricter throttle value ("during quiet hours, limit to 1 MB/s") rather
  than only being a hard on/off gate — this is a nicer, more flexible
  behavior than IDM's binary scheduler and worth calling out as a
  genuine improvement, not just parity.

## The shared execution-decision function
```
fn should_execute_now(task: &Task, settings: &AutomationSettings) -> ExecutionDecision {
    // 1. scheduled_for in the future? -> Wait
    // 2. quiet_hours active and task not marked "ignore_quiet_hours"? -> Wait (or throttled-run, per setting)
    // 3. currently-running count >= max_concurrent_downloads? -> Wait, queued at its queue_position
    // 4. otherwise -> Run, with the resolved rate limit for current conditions
}
```
Every one of the four features above is implemented as an input to this
one function, not as four separate gate-checks scattered through the
codebase. This keeps the four features testable in isolation and
prevents the classic bug where two automation features silently
contradict each other (e.g. a rule says auto-start, but quiet hours says
wait — the function above has an explicit, singular precedence order to
resolve that, rather than whichever code path happens to run first
winning by accident).

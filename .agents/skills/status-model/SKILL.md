---
name: status-model
description: Use for ANY change touching task status — Rust's status enum, the download-progress event, or the frontend's status badge/color/icon rendering. This is the exhaustive, closed list of every state a task can be in. No new status string may be introduced without adding it here first, on both the Rust and TypeScript sides in the same change.
---

# Status Model — the exhaustive state list

## Why this exists
A status that exists in Rust's emitted event but has no matching case in
the frontend's color/label mapping renders as an undefined fallback (this
is almost certainly what caused the unexplained yellow state) — silently,
with no error, because JS doesn't crash on an unhandled string. This skill
makes that class of bug structurally impossible: the list below is closed,
both sides derive from it, and no PR may add a status string to one side
without the other.

## The complete list (12 states, no others exist)
See `references/status.rs` and `references/status.ts` for copy-pasteable
definitions. Table form for quick reference:

| Status | Meaning | Terminal? | Progress bar? | Color token |
|---|---|---|---|---|
| `scheduled` | Task created with a future start time (see scheduler-and-rules skill) — will transition to `queued` automatically when its scheduled time arrives | No | Hidden, shows scheduled time instead | `text-tertiary` |
| `queued` | Task created, not yet started | No | Indeterminate/empty | `text-tertiary` |
| `starting` | Sidecar process spawned, no output yet (the "instant feedback" state — must appear within one frame of the user's click) | No | Indeterminate pulse | `accent` |
| `fetching_metadata` | `yt-dlp --dump-json` in flight (Analyze step, not a download) | No | Indeterminate pulse | `accent` |
| `downloading` | Fragments actively transferring | No | Determinate, real percent | `accent` |
| `muxing` | Download done, ffmpeg merging streams — this is its own state, never left showing "downloading" at 100% | No | Indeterminate pulse (ffmpeg mux progress isn't reliably parseable — don't fake a percent) | `accent` |
| `verifying` | Post-mux ffprobe integrity check (FR-2.4) before the atomic rename | No | Indeterminate pulse | `accent` |
| `completed` | File verified and renamed into place | **Yes** | Full bar, filled | `status-success` |
| `error` | Any failure — spawn failure, non-zero exit, failed verification | **Yes** | Bar cleared/hidden | `status-danger` |
| `cancelled` | User-initiated stop, process tree confirmed killed | **Yes** | Bar cleared/hidden | `text-tertiary` |
| `interrupted` | Restored on app relaunch — was mid-task when the app last closed; awaiting user's explicit Resume/Discard choice (per sqlite-history skill — never auto-resume) | No | Hidden, shows a "Resume?" prompt instead | `status-warning` |
| `missing` | History row whose output file no longer exists on disk (deleted outside the app) | **Yes** | N/A — this is a history-list state, not a queue state | `status-tertiary` (use `text-tertiary` + a distinct icon, not a status color — this isn't a failure, just an absent file) |

## Rules
1. **No bare string statuses.** Every status the Rust backend can ever
   emit is one of these 11 values, defined as a real enum
   (`references/status.rs`), serialized via serde with these exact
   snake_case tags. Never emit an ad hoc string like `"processing"` or
   `"in_progress"` that isn't in this table.
2. **The frontend switch must be exhaustive, not defaulted.** Use a
   TypeScript union type (`references/status.ts`) so the compiler errors
   if a case is missing — don't write a `switch` with a silent
   `default: return greyColor`. If Rust adds a 12th status someday, the
   build should fail on the frontend until it's handled, not silently
   render wrong.
3. **`muxing` and `verifying` never fake a percentage.** ffmpeg's mux
   progress isn't reliably parseable from stdout the way yt-dlp's
   download percent is — don't interpolate a fake number climbing to
   100%. Show an indeterminate/pulsing bar instead. A fake percentage
   that doesn't match real elapsed time erodes trust faster than an
   honest "working on it" spinner.
4. **`error` always carries a `errorCode` field**, not just the status —
   a small closed set of codes (`network`, `age_restricted`,
   `unavailable`, `disk_full`, `verification_failed`, `spawn_failed`,
   `unknown`) so the UI can show a specific, human message per code
   rather than one generic "Something went wrong." This ties back to the
   subprocess-reliability skill's rule against passing raw stderr to the
   UI.
5. **Any new status proposal must update three things in the same
   change:** this table, `references/status.rs`, and
   `references/status.ts`. A PR that adds a Rust-side status without the
   matching frontend case (or vice versa) is incomplete, full stop.

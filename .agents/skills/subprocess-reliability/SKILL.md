---
name: subprocess-reliability
description: Use for ANY change that spawns, pipes, or reads output from yt-dlp or ffmpeg — start_download, fetch_video_info, cancel logic, or anything touching Stdio, stdin/stdout/stderr, or sidecar paths. This encodes real bugs already hit once in this codebase (pipe deadlock, hung overwrite prompt, console flash, dropped CSS import). Do not reintroduce them.
---

# Subprocess Reliability — Lessons Already Paid For

Every rule below maps to an actual bug that already happened in this app
and cost real debugging time. Treat this as a regression checklist, not
theory — if a diff touches subprocess spawning and violates one of these,
flag it before merging.

## 1. Never leave a piped stream undrained (the pipe-deadlock bug)
**What happened:** `yt-dlp` piping into `ffmpeg` for muxing filled the OS
pipe buffer (~64KB on Windows) with `ffmpeg`'s stderr logs. Nothing was
reading that pipe, so the OS paused `ffmpeg`, which paused `yt-dlp`, which
froze the whole app at 100%.

**What was actually done:** `stderr(Stdio::null())` — this stops the
deadlock but silently discards every real ffmpeg error message forever.
That's a trap: the next time a download genuinely fails during muxing
(corrupt fragment, disk full, bad codec combo), there will be zero
diagnostic output to explain why, in an app whose whole premise is "no
issues must occur."

**The correct fix:** pipe stdout AND stderr, and drain both
**concurrently** with the process wait — never let any piped stream sit
unread. In Rust with `tokio::process`, this is a `tokio::join!` over
`child.wait()` and a line-reader task for each stream (or two dedicated
threads if using `std::process` instead of tokio). Log stderr lines
somewhere (even just an in-memory ring buffer surfaced in a "View Log"
button) instead of nulling them — you want the deadlock fix AND the
diagnostics, not one traded for the other.

**Rule going forward:** any `Stdio::piped()` on stdin, stdout, or stderr
must have an active reader wired up before the process can produce enough
output to fill a buffer. If a stream's content is genuinely never needed,
use `Stdio::null()` deliberately and say why in a comment — don't null it
as an emergency deadlock fix without coming back to do it properly.

## 2. Every headless CLI invocation must be forced non-interactive
**What happened:** a stale partial `.mp3` from a failed attempt made
`ffmpeg` ask "Overwrite? [y/N]" on stdin. There was no terminal attached,
so the process hung forever waiting for input that could never arrive.

**Rule:** any time you spawn `yt-dlp` or `ffmpeg`, stdin must be
`Stdio::null()` (already fixed) AND every flag that could ever trigger an
interactive prompt must be passed explicitly up front — `--force-overwrites`
and `-y`/`--yes`-equivalent flags — not discovered reactively after a hang.
Before adding any new yt-dlp/ffmpeg flag or feature, check whether it has a
"prompt on conflict" behavior and preempt it the same way.

## 3. Stale partial output files are a first-class case, not an edge case
The overwrite-prompt hang only happened because a failed download's partial
file was left behind. On any download failure or cancellation, delete the
partial output (or, if resumability is wanted later, track it explicitly in
state rather than leaving an orphaned file for the next run to trip over
silently).

## 4. Sidecar paths must be absolute and resolved once, not implied
**What happened:** `ffmpeg` couldn't be found because a directory was
passed where yt-dlp expected an exact executable path via
`--ffmpeg-location`.

**Rule:** resolve the sidecar binary's absolute path once (dev: `src-tauri/
bin/`, prod: the app resource dir, future: `%LOCALAPPDATA%` for the
self-updating copy) and always pass the exact file path, never a directory,
to any flag that names an external tool. Don't let path resolution logic
live inline at each call site — one resolver function, reused everywhere a
sidecar is invoked.

## 5. Every spawned sidecar needs CREATE_NO_WINDOW on Windows
Any `Command` that spawns `yt-dlp` or `ffmpeg` on Windows must set the
`0x08000000` creation flag, or a console window will flash on screen every
single invocation — this was already fixed once for one code path; if a
new call site spawns either binary without it, that's a regression.

## 6. Cold-start latency needs an immediate optimistic UI event
`yt-dlp`'s Python bundle takes a few seconds to warm up. Any user-triggered
action that spawns it (analyze, download) must emit an instant "starting…"
state to the frontend the moment the command is invoked — before the
sidecar has produced any real output — so the UI never looks frozen during
that warm-up window. This applies to every future action that spawns a
sidecar, not just the ones already built.

## 7. Don't let scaffold/entry-point files silently regress
**What happened:** `import "./App.css"` was dropped from `main.tsx` during
unrelated iteration, so the whole app rendered unstyled with no error or
warning — nothing crashed, it just looked broken.

**Rule:** after any edit to a bootstrap/entry file (`main.tsx`,
`lib.rs`'s app-builder setup, `tauri.conf.json`), do a quick diff-level
sanity check that no existing import, registration, or plugin call was
dropped — these files have no compiler error to catch a silently-missing
import in the framework-relevant sense (CSS imports, event listener
registration), so it has to be caught by review, not by `cargo check`.

## 8. Rust backend changes require a full restart, not hot-reload
`npm run tauri dev`'s frontend hot-reload does NOT recompile the Rust
binary. After any `.rs` change, the dev server must be stopped and
restarted before testing — don't report "try it now" without noting this,
and don't assume a fix is live just because no error was shown.

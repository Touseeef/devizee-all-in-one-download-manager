---
name: sidecar-manager
description: Use when spawning, tracking, cancelling, or tearing down the yt-dlp or ffmpeg sidecar processes from Rust — anything touching process lifecycle, PIDs, Job Objects, or "zombie process" bugs. Covers FR-2.1, FR-3.2, NFR-4.
---

# Sidecar Process Manager

## When to use
Any Tauri command that spawns `yt-dlp` or `ffmpeg`, or manages their
lifecycle: `start_download`, `cancel_download`, pause/resume, or app-exit
cleanup.

## What "correct" looks like
1. Spawn sidecars via Tauri's `shell::Command` (or `tauri-plugin-shell` in v2),
   never `std::process::Command` directly — this keeps binary resolution
   consistent with the sidecar manifest in `tauri.conf.json`.
2. Every spawned task gets a `task_id` (UUID) the moment it's created, stored
   in a `HashMap<String, ChildHandle>` (or similar) guarded by a mutex —
   before the process even starts producing output. The frontend must be
   able to cancel a task the instant it's queued, not just once it's running.
3. On Windows, assign the child process to a Job Object with
   `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` so that killing the parent handle
   reliably kills yt-dlp's spawned ffmpeg child too. A bare `child.kill()`
   on the yt-dlp process alone is NOT sufficient — this is the #1 zombie-
   process bug in every prior yt-dlp GUI project.
4. On app exit, iterate the active-task map and terminate every process tree
   before the Tauri event loop closes — don't rely on the OS cleaning up.
5. Cancellation must also clean up the `.part` file left in the temp dir
   (delete it, or leave it only if you're implementing resumability — see
   NFR-5 — in which case leave it and record its path in SQLite instead).

## Anti-patterns to reject
- Storing only the yt-dlp PID and assuming ffmpeg dies with it.
- Blocking the Tauri main thread on `child.wait()` — always await
  asynchronously so the UI stays responsive.
- Silently swallowing a spawn failure (missing binary, bad permissions) —
  surface it as a typed error the frontend can render, per the "no raw
  yt-dlp stack traces" requirement.

---
name: engine-updater
description: Use when implementing or touching the yt-dlp self-update mechanism — GitHub Releases API checks, %LOCALAPPDATA% binary placement, atomic binary replacement. Covers FR-4.1, FR-4.2. This is the single most important reliability feature in the app.
---

# Engine Self-Updater

## Why this skill exists
README calls this out as resolving "the #1 problem with downloaders" —
YouTube changes break yt-dlp's extractors constantly, and an app shipping a
frozen yt-dlp binary goes stale within weeks. Get this right before
polishing anything cosmetic.

## Requirements (FR-4.1, FR-4.2)
1. The *live, updatable* yt-dlp binary must live in a user-writable location
   — `%LOCALAPPDATA%\Devizee\bin\` on Windows — never inside `Program
   Files`, which requires elevated permissions to write to and will make
   updates silently fail for non-admin users.
2. On first run, copy the bundled sidecar binary (shipped inside the
   installer, under `src-tauri/bin/`) into that user-writable location if
   it isn't already there. All subsequent invocations run the copy in
   `%LOCALAPPDATA%`, not the read-only bundled one.
3. On startup (and on manual "Check for updates"), query the GitHub
   Releases API for `yt-dlp/yt-dlp` latest tag. Compare against the
   currently-installed binary's reported version (`yt-dlp --version`).
4. If newer: download the new binary to a temp file, verify it downloaded
   completely (size check against the release asset metadata), then
   atomically swap it into place (`rename`, same filesystem) — never
   overwrite the binary that might currently be in use by an active
   download; check the active-task map from the sidecar-manager skill
   first and defer the swap if a task is running.
5. Cache the last-checked timestamp so you're not hitting GitHub's API on
   every single launch — respect their unauthenticated rate limit (60
   req/hour per IP). A weekly check is sufficient per the earlier plan;
   expose a manual "check now" button for impatient users.
6. Never point users at YouTube-specific error messages that imply the app
   itself is broken when it's actually a stale-extractor issue — the
   updater existing is the fix; the error state should say "checking for
   an engine update" rather than a raw traceback when a download fails
   with a pattern matching known extractor-breakage signatures.

## ffmpeg is NOT self-updated
Only yt-dlp needs this treatment — ffmpeg's format-muxing logic doesn't go
stale the way platform extractors do. Keep ffmpeg bundled and static;
don't build update machinery for it unless a real bug report demands it.

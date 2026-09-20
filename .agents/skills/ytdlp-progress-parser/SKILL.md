---
name: ytdlp-progress-parser
description: Use when parsing yt-dlp stdout into progress events, wiring --newline output, --dump-json metadata parsing, or emitting the taskId/percent/speed/eta/status event shape to the frontend. Covers FR-1.2, FR-3.1.
---

# yt-dlp Progress Parser

## When to use
Implementing or debugging: metadata fetch (`fetch_metadata`), or the
line-by-line stdout reader that turns yt-dlp output into live progress
events.

## Metadata fetch (FR-1.2)
- Call yt-dlp with `--dump-json --no-warnings --skip-download`. Parse a
  single JSON object per URL (or one per line for playlists with
  `--flat-playlist` first, then a second pass for per-item detail — don't
  eagerly resolve every playlist item's full JSON up front, it's slow and
  most users only want a subset).
- Pull `title`, `thumbnail`, `duration`, `uploader`/`channel`, and the
  `formats[]` array. Map raw format codes to the human-readable tiers in
  FR-1.3 (4320p/8K down to 360p, plus audio-only presets) — build this
  mapping as a pure function so it's independently testable.
- 3-second budget in FR-1.2 is a UX target, not a hard timeout — don't
  abort the yt-dlp process at 3s, just make sure the loading state in the
  UI doesn't feel frozen (skeleton/spinner immediately, not after a delay).

## Progress parsing (FR-3.1)
- Always invoke with `--newline` so progress lines are flushed one-per-line
  instead of using `\r` carriage-return overwrites — without this you get
  no usable stdout stream to parse.
- Read stdout with a line-buffered reader (`BufReader::lines()` in Rust),
  not a raw byte stream — partial-line reads are the usual cause of
  progress bars that "jump" or show garbage.
- Emit exactly this shape per parsed line, no more, no less (matches
  AGENTS.md and SRS FR-3.1):
  ```json
  { "taskId": "uuid", "percent": 68.4, "speed": "14.2MiB/s", "eta": "00:23", "status": "downloading" }
  ```
- Status values to support: `queued`, `downloading`, `muxing`, `completed`,
  `error`, `cancelled`. `muxing` is its own status — don't leave the UI
  stuck at 100% downloading while ffmpeg is still merging in the
  background; that's a common complaint in this app category.
- Parse errors (non-zero exit, stderr content matching known yt-dlp error
  patterns like age-restriction or geo-block) into a small closed set of
  error *codes*, and let the frontend own the human-readable message —
  don't pass raw stderr text through to the UI.

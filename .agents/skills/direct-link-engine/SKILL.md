---
name: direct-link-engine
description: Use when building or touching the generic file-download path — any URL that ISN'T a yt-dlp-supported streaming site (a .zip, .iso, .exe, .pdf, direct file link). Covers segmented/multi-connection acceleration, resume, server-capability detection, and the virus-scan-on-complete hook. This is a separate engine from the yt-dlp path — do not merge their code paths.
---

# Direct-Link Acceleration Engine

## Why this is a separate engine, not a yt-dlp mode
yt-dlp is an *extractor* — it understands specific sites' page structure
and streaming manifests. It has no special value for a plain file URL
(`https://example.com/installer.exe`); pointed at one, it just does a
single-connection HTTP GET, which is exactly the slow, un-accelerated
behavior this feature exists to fix. This is IDM's actual original,
core feature — multi-connection segmented downloading of one file — and
it needs its own code path, its own sidecar, and its own status/UI
affordances. Do not try to make yt-dlp do this; it's the wrong tool.

## Engine choice: `aria2c`
Use `aria2` as a third sidecar binary (same pattern as `yt-dlp`/`ffmpeg`:
`src-tauri/bin/aria2c-x86_64-pc-windows-msvc.exe`, resolved through the
same absolute-path resolver from the sidecar-manager skill). It is free,
open-source (GPL-2.0), actively maintained, purpose-built for exactly
this — segmented multi-connection HTTP/FTP/BitTorrent downloading with
resume — and has a JSON-RPC / `--summary-interval` output mode that's far
easier to parse reliably than scraping a progress bar's stdout.

Do not hand-roll segmented downloading with raw `reqwest` range requests
in Rust unless `aria2c` proves genuinely unsuitable in testing — resume
correctness, connection retry/backoff, and redirect handling are exactly
the kind of edge-case-riddled code you do NOT want to own when a
battle-tested tool already exists for free.

## URL routing decision (the entry point)
When a URL is pasted or analyzed, decide the engine BEFORE spawning
anything:
1. Try `yt-dlp --dump-json --simulate` first (cheap, already built) — if
   it succeeds, this is a supported streaming site, route to the existing
   yt-dlp path.
2. If yt-dlp reports "unsupported URL," treat it as a direct-link
   candidate. Issue a `HEAD` request (or `aria2c`'s own probe) to check:
   - Does the response include `Content-Length`? (needed to know total
     size and whether segmentation is even possible)
   - Does the server return `Accept-Ranges: bytes`? (needed for
     multi-connection segmentation — if absent, fall back to a single
     connection rather than guessing)
   - Is the `Content-Type` something the app should warn about (e.g.
     `text/html` often means the URL is actually a webpage, not a direct
     file, and the "download" would just save a login/error page — warn
     the user rather than silently saving garbage).
3. Surface this decision to the user as an explicit UI distinction before
   download starts: "Media download" (yt-dlp path, shows format picker)
   vs. "File download" (direct-link path, shows filename + size from
   `Content-Length` + segment count instead of a quality picker). Don't
   silently merge these into one generic "download" button — the user
   needs different information for each.

## Segmentation strategy
- Default to `--split=8 --max-connection-per-server=8` as a starting
  point, but make it adaptive, not fixed: if `Content-Length` reports a
  small file (under ~5MB), segmentation overhead isn't worth it — use
  `--split=1`. Scale up for larger files. Never hardcode a single global
  number the way a v1 implementation might.
- Respect `Accept-Ranges` absence by falling back to `--split=1`
  automatically — aria2c does this itself, but verify it's not silently
  retrying failed range requests in a way that looks like a hang to the
  user (surface a "This server doesn't support accelerated downloads,
  downloading normally" status distinction instead of pretending it's
  still multi-connection).

## Resume across app/computer restarts (closes the real IDM gap)
- aria2c writes a `.aria2` control file alongside the partial download —
  don't delete this on app close, and on next launch, detect matching
  `.aria2` control files for any task marked `interrupted` in SQLite and
  resume via `aria2c -i` (input file) rather than restarting from byte 0.
  This is the concrete implementation of the `interrupted` status your
  status-model skill already defines — this engine is one of the two
  places that status applies (the other being yt-dlp downloads).
- Test this specifically: kill the app mid-download (not just cancel,
  actually close the process), relaunch, confirm the resume picks up from
  the last completed segment, not from zero. This is the exact scenario
  IDM markets itself on ("resume after power outage") — it needs to
  actually work, not just be spec'd.

## Filename & save-path handling
Reuse the filename sanitization and atomic-rename logic from the
ffmpeg-muxing skill (illegal Windows characters, path-length limits,
`.part`-suffix-then-atomic-rename) — don't duplicate that logic, extract
it into a shared function both engines call. A file is a file regardless
of which engine produced it; the completion contract (verify size against
`Content-Length`, then atomically rename) should be identical.

## Completion hook: optional virus scan
On completion of a direct-link download specifically (executables and
archives are the actual risk category — video/audio files from the
yt-dlp path don't need this), offer an opt-in Settings toggle: "Scan
downloaded files with Windows Defender." If enabled, shell out to
`MpCmdRun.exe -Scan -ScanType 3 -File <path>` as a background task after
the file lands, non-blocking — the file is already usable, this is a
courtesy check, not a gate. Surface the result as a small badge
("Scanned — clean" / "Warning — flagged, see details") rather than a
blocking modal. This directly targets the #1 trust hesitation people have
about download-manager-category apps, which matters more for an
open-source project than a paid one — users can read your code, but they
still need reassurance about what they downloaded.

## Edge cases specific to this engine
- **Redirect chains** — some direct-file hosts redirect through 2-3 URLs
  before the real file; aria2c follows these, but make sure the *saved
  filename* comes from the final URL/`Content-Disposition` header, not
  the originally pasted link.
- **`Content-Disposition` filename vs URL-derived filename** — prefer the
  header when present (it's the server's intended filename), fall back to
  parsing the URL path otherwise, and always run both through the shared
  sanitizer.
- **Auth-walled downloads** — if a HEAD request returns 401/403, don't
  retry blindly; surface a clear "This link requires sign-in" error state
  (`errorCode: "unavailable"` fits the existing model) rather than
  spinning through retries a user can't fix by waiting.
- **Disk-space check before segmentation starts** — reuse the NFR from
  the original SRS (check available space against `Content-Length`
  before writing anything) — this engine downloads arbitrarily large
  files (ISOs, archives) more often than the video path does, so this
  check matters more here, not less.

---
name: clipboard-radar
description: Use when building or touching the Smart Clipboard Radar feature — background clipboard monitoring, the floating quick-grab HUD window, or its Settings toggle. This is a privacy-sensitive, opt-in feature (clipboard content is sensitive data) — read the privacy rules below before writing any polling code.
---

# Smart Clipboard Radar

## What it is
While Devizee is running, copying a supported media URL anywhere on the
system (browser address bar, a chat app, a tweet) pops a small, unobtrusive
floating HUD near the cursor/screen corner with the thumbnail and one-click
format buttons — no need to switch to the main app window. This is the USP
that closes the gap with IDM's clipboard detection, but done with a nicer,
non-intrusive surface (a dismissible HUD, not a jarring window steal).

## Privacy rule — read this first
Continuous clipboard access is one of the more privacy-sensitive things an
app can do on a user's machine, and it's a legitimate reason security-
conscious users (and antivirus heuristics) get suspicious of download
managers specifically. This is non-negotiable:
- **Default OFF.** On first launch, this feature is disabled. Prompt once,
  clearly: "Devizee can watch your clipboard for video/audio links and
  offer a quick-download popup. Nothing is read unless you enable this."
  A Settings toggle controls it afterward — no re-prompting.
- **Never persist clipboard content.** Not to SQLite, not to a log file,
  not to any diagnostic export. The clipboard string is read, checked
  against the URL patterns below, and immediately discarded if it doesn't
  match — it never leaves memory, and even a match is only ever used to
  construct the HUD's preview, never written to disk as a "clipboard
  history."
- **Only act on strings that look like supported media URLs.** Don't run
  every clipboard change (passwords, code snippets, random text) through
  any network call or logging path — cheap local regex/domain-allowlist
  check first, and only proceed to `fetch_metadata` if it matches.

## Implementation
- Use Tauri's clipboard plugin, polling on a timer (~800ms–1s interval) —
  there's no reliable native "clipboard changed" event across platforms,
  so debounced polling is the standard approach. Keep the interval modest;
  this runs for the app's whole lifetime, so CPU cost matters even though
  each check is cheap.
- Debounce/dedupe: hash (don't store raw) the last-seen clipboard string
  in memory only, and skip re-triggering the HUD for the same value
  repeatedly, or for a URL that's already `queued`/`downloading`/
  `completed` in the current session's task list.
- URL match: a fast local check first (regex/domain allowlist for known
  supported platforms), THEN a real `fetch_metadata` call only once that
  passes — don't hit the network or spin up yt-dlp for clipboard content
  that doesn't even look like a URL.
- Pause polling entirely while the app window doesn't have any active
  task and the user hasn't touched the app in a while, if the OS
  provides an easy idle/suspend signal — not critical for v1, but note it
  as a follow-up so this doesn't quietly become a background battery/CPU
  complaint on laptops.

## The HUD window
- A second, small, borderless, always-on-top Tauri window (Tauri
  natively supports multiple windows) — transparent background, rounded
  card, thumbnail + title truncated to one line + 2-3 quick-action
  buttons ("Best Quality", "Audio MP3", "Customize…" which opens the main
  window with the URL pre-filled).
- Must be **non-activating** (doesn't steal focus from whatever the user
  was doing when they copied the link) — on Windows this means the
  window needs the `WS_EX_NOACTIVATE` extended style; verify Tauri v2's
  window builder exposes this, or apply it via the raw `windows` crate
  against the window handle if not. Without this, the HUD popping up
  mid-typing in another app is exactly the kind of intrusive behavior
  this feature is supposed to avoid.
- Auto-dismiss after ~6-8 seconds of no interaction, or immediately on
  click-away/Escape. Never require the user to explicitly close it for
  the common case where they don't want to act on it.
- The HUD's action buttons call the exact same Tauri commands
  (`start_download`, etc.) as the main window — no separate/duplicated
  download logic. It's a different entry point into the same engine, not
  a parallel one.
- Position: near the current cursor position if obtainable, else a fixed
  screen corner (bottom-right, matching most OS notification
  conventions) — pick one fallback and keep it consistent rather than
  guessing per-platform.

## Edge cases
- Clipboard contains a playlist URL — same "explicit message, never
  silent partial action" rule from the playlist-handling decision made
  earlier in this project: the HUD should say "Playlist detected — open
  in app to choose videos" rather than silently grabbing just the first
  video.
- Rapid repeated copies (user copying several links in quick succession,
  e.g. from a list) — queue additional HUD triggers rather than replacing
  one HUD's content out from under the user mid-read; a small stacked/
  cycling indicator ("2 more") is acceptable for v2, but v1 can simply
  show the most recent and drop intermediate ones if they're dismissed
  before being read — don't silently start downloading something the
  user never actually saw.
- App is minimized/closed — no HUD, obviously; but if the app was closed
  entirely, clipboard monitoring must actually stop (don't leave an
  orphaned background process polling clipboard after the main app
  process exits — tie the polling task's lifetime directly to the app's
  process lifetime).

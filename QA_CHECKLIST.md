# Devizee QA Regression Checklist

Running, cumulative regression checklist of every bug reported and resolved across Devizee. Use this checklist during testing to prevent regressions.

| Date | Bug / Feature Area | Description | Verification Note (One-Line) | Status |
|---|---|---|---|---|
| 2026-09-19 | Sidecar / Job Objects | Zombie yt-dlp/ffmpeg processes remaining on app close | Terminate app via Task Manager; confirm child CLI processes exit immediately via Windows Job Object. | PASS |
| 2026-09-19 | In-App Video Player | Missing video stream playback in desktop UI | Paste YouTube link, click thumbnail; confirm in-app video buffers and plays with custom controls. | PASS |
| 2026-09-19 | Audio Scrubbing | Inability to seek through audio previews | Click "Listen", drag audio slider or click jump buttons; confirm audio seeks accurately. | PASS |
| 2026-09-19 | Trimming USP | Video clip start/end timestamps ignored | Toggle "Trim Clip", set start/end; verify yt-dlp receives `--download-sections` and `--force-keyframes-at-cuts`. | PASS |
| 2026-09-20 | Fullscreen Player Exit | Fullscreen close button paused/stopped playback | Enter fullscreen, click X or press Esc; verify fullscreen exits while video continues playing. | PASS |
| 2026-09-20 | Volume Synchronization | Video player volume desynced from audio and settings | Adjust video volume slider; verify audio preview and Settings reflect the identical volume level. | PASS |
| 2026-09-20 | Autoplay & Tab Switching | Switching tabs unexpectedly restarted media playback | Play video, switch to Settings tab, switch back; verify playback does not auto-restart. | PASS |
| 2026-09-20 | Single Now-Playing | Video and Audio Hub tracks playing simultaneously | Play a video, then click play on an Audio Hub track; verify video pauses immediately. | PASS |
| 2026-09-20 | Download Disappearing | Main analyzed card wiped from view on download start | Click 1080p download pill; confirm card transitions into live progress display with speed and ETA. | PASS |
| 2026-09-20 | File Open & Show in Folder | Double click row or click row folder icon | Double-click completed row (opens in default OS app); click folder button (opens explorer with item highlighted). | PASS |
| 2026-09-20 | Speed & ETA Display | Speed and ETA missing or unreadable on active rows | Start a download; verify "X MB/s • ETA Y:YY" appears with legible text-secondary styling. | PASS |
| 2026-09-20 | Format Discrimination | Videos misclassified as audio due to `bestaudio` in format string | Download 1080p video; click "Video" filter chip and confirm it displays under Video, not Audio. | PASS |
| 2026-09-20 | Playlist Batch Download | Bulk download wiped UI and lacked format selector | Analyze playlist; verify format picker appears, downloads transition to BatchProgressView, and batch controls work. | PASS |
| 2026-09-20 | Download Folder Picker | Save folder hardcoded and lacked native browser | Go to Settings -> Downloads, click "Browse..."; select folder and verify subsequent downloads save to it. | PASS |
| 2026-09-20 | Audible Completion Chime | Completion sound toggle did not trigger any audio | Complete a download with "Audible Completion Chime" enabled; verify pleasant chime plays. | PASS |
| 2026-09-20 | Downloads Search & YouTube Search | No search in activity list or keyword search | Type query in Activity search to filter; type keywords in top bar to get interactive YouTube search cards. | PASS |
| 2026-09-20 | Browser Extension Pause | Extension lacked master pause control for link grabbing | Open extension popup; toggle "Pause Link Grabbing" and verify browser downloads are not cancelled. | PASS |
| 2026-09-20 | Single-Instance Relay | Native messaging spawning duplicate Devizee windows | Trigger extension download while app is running; verify URL forwards to existing window without opening duplicate. | PASS |
| 2026-09-20 | P0: Path & Error Surfacing | Relative paths, invisible failures, dropped UTF-8 lines, raw format string | Canonicalize download path to user download dir; extract Destination: losslessly; categorize stderr errors; surface human-readable reason + Retry button | PASS |
| 2026-09-20 | P1: Native Host Binary | Chrome native messaging failing due to .bat/.ps1 pipe corruption & startup latency | Build dedicated Rust binary devizee_host.exe; parse 4-byte length prefix & JSON; respond with length-prefixed {"status":"ok"} | PASS |
| 2026-09-20 | P2: Unified Media Player State | Volume desynced on YouTube preview player and Audio Hub | Wire <audio> (line 1620), <video> (line 1873), and <iframe> (line 1937) to shared volume, isMuted, and sendIframeCommand | PASS |
| 2026-09-20 | P3: Quality Selection Gating | Download button inactive until quality/audio format is selected | Wire format pills/dropdowns to selectedFormat state; render explicit Primary Download Button gated with disabled={!selectedFormat} | PASS |
| 2026-09-20 | P4: Failed-Download Row Design | Thin red underline on error without clear explanation or retry | Render failure card in HistoryItem and active card with AlertCircle, human reason from ERROR_MESSAGES, and working Retry button | PASS |
| 2026-09-20 | P5: Disappearing Trigger Audit | Download triggers vanishing instead of transitioning to progress | Transition main card to live progress & spinner; render live in-flight progress on Audio Hub; show progress and single-download on playlist entries | PASS |
| 2026-09-20 | P6: Speed / ETA / Size Metrics | Low contrast speed/ETA text borrowing status colors | Add dedicated surface-2 3-column metrics container (Speed / ETA / Progress) under progress bar in HistoryItem and active card | PASS |
| 2026-09-20 | P7: Audio Hub Remux Optimization | Slow audio extraction due to unconditional re-encoding | Select native stream (ba[ext=m4a] / ba[ext=webm]) in start_download; confirmed ffmpeg uses direct stream copy (-c copy) | PASS |
| 2026-09-20 | P8: Filter Bar Layout Reflow | Filter bar shifts page layout when switching chips or opening dropdowns | Give filter bar container reserved min-h-[72px] sm:min-h-[42px] eliminating surrounding layout jump | PASS |
| 2026-09-20 | P9: Per-File-Type & Temp Locations | Global single save location without temp staging separation | Add Video/Audio/General/Temp folder settings in UI; wire customDir and tempDir (-P temp:...) to start_download in Rust | PASS |
| 2026-09-20 | P10: Navigation Robustness & Error Boundary | Unhandled render errors or async rejection freezing tab switching | Implement ErrorBoundary component wrapping root and main workspace; ensure all async handlers reset flags in finally blocks | PASS |
| 2026-09-23 | SEC-5: CSP (already fixed before this audit) | CSP was null in tauri.conf.json | Confirmed present: `grep '"csp"' src-tauri/tauri.conf.json` returns a non-null policy string | PASS |
| 2026-09-23 | SEC-1: Argument injection via custom_flags | custom_flags split by whitespace and passed directly to yt-dlp | Code review: verify lib.rs custom_flags block uses ALLOWED_LONE / ALLOWED_VALUE allowlists; attempt to pass `--exec calc` in settings and confirm it is silently dropped (no process launched) | PENDING |
| 2026-09-23 | SEC-2: open_file cmd /C start → opener plugin | open_file used cmd.exe with user path, enabling shell command injection | Code review: verify lib.rs open_file uses `app.opener().open_path()`; attempt to open a `.bat` file path and confirm "Cannot open executable files" error is returned | PENDING |
| 2026-09-23 | SEC-3: read_local_file path bounds | read_local_file read any file on disk | Code review: verify canonicalize + starts_with guard present; invoke with `C:\Windows\System32\cmd.exe` and confirm "Access denied" error | PENDING |
| 2026-09-23 | SEC-4: native host cmd /C start → ShellExecuteW | devizee_host.rs fallback used cmd.exe for protocol dispatch | Code review: verify dispatch_url has URL scheme validation + ShellExecuteW usage; no cmd.exe or shell in fallback path | PENDING |
| 2026-09-23 | SEC-6: delete_history_file path bounds | delete_history_file deleted any file on disk | Code review: verify canonicalize + starts_with guard present; invoke with path outside download dir and confirm "Access denied" | PENDING |
| 2026-09-23 | SEC-7: filename_template path traversal | template containing ../ could escape download dir | Code review: verify template.contains("..") check + --restrict-filenames arg present; attempt `../../Desktop/test` template and confirm error | PENDING |
| 2026-09-23 | SEC-8: protocol handler URL validation | streamgrab:// handler emitted any URL scheme | Code review: verify decoded URL is http/https before emit; send `streamgrab://download?url=file:///etc/passwd` and confirm no open-url event fires | PENDING |
| 2026-09-23 | SEC-9: extension cookie transmission | background.js sent browser cookies over native messaging | Code review: verify cookies field removed from payload in background.js; no cookie collection code present | PENDING |
| 2026-09-23 | SEC-10: Mutex::unwrap() on DB lock | All db_conn.lock() calls used .unwrap(), panicking on poison | `grep -n "db_conn.lock().unwrap()" src-tauri/src/lib.rs` returns no results | PENDING |
| 2026-09-23 | SEC-N1: assetProtocol wildcard scope | "**/*" in assetProtocol.scope granted asset:// to any file | Code review: verify tauri.conf.json scope only lists $DOWNLOAD, $VIDEO, $AUDIO, $PICTURE, $APPDATA, $LOCALDATA | PENDING |





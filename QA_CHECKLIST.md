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

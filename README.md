# Devizee — All-In-One Download Manager

Fast, native Windows download manager powered by yt-dlp and ffmpeg, built with Tauri + Rust.

## Status

Pre-release (v0.1.0). Actively developed — v0.2.0 in stabilization.

## Features

- **Broad site support** — YouTube, SoundCloud, Vimeo, and 1000+ sites via yt-dlp
- **In-app playback** — video preview and Audio Hub media player
- **Playlist support** — browse, select, and batch-download playlist tracks
- **Clip-before-download** — trim start/end before the download begins
- **Per-file-type save locations** — Videos, Audio, Documents, Compressed, Programs
- **Six visual themes** — Light, Dark, OLED, Sunset, Frost, Signature
- **Native Windows integration** — system tray, global hotkey, taskbar progress
- **Zero telemetry** — no analytics, no external calls except to the source site

## Download

Installers will be published under [Releases](../../releases) when v0.2.0 ships.

## Building from source

**Prerequisites:** Node.js 20+, Rust 1.75+, Windows 10 or 11.

```bash
npm install
npm run tauri dev      # development
npm run tauri build    # production installer

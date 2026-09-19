# StreamGrab (Tauri v2 + Rust Media Downloader)

A high-performance, ultra-lightweight desktop media downloader built with **Tauri v2**, **Rust**, and modern web technologies. Powered by `yt-dlp` and `ffmpeg` bundled as native sidecar binaries.

---

## Key Features

- **Ultra-Lightweight**: Built on native OS WebViews (Webview2 on Windows). Consumes ~35MB RAM vs 250MB+ in typical Electron alternatives.
- **Full Quality Range**: Extract and download 1080p, 2K, 4K, and 8K videos with synchronized audio streams automatically multiplexed via FFmpeg.
- **Audio Extraction**: 1-click conversion to high-bitrate MP3, AAC, FLAC, or Opus with embedded tags and cover art.
- **Auto-Updating Extraction Engine**: Resolves the #1 problem with downloaders (YouTube breaking changes) by dynamically updating `yt-dlp` in user space without requiring full app reinstalls.
- **Real-Time Streaming Metrics**: Line-buffered stdout parsing for instantaneous download speed, ETA, and progress bar updates.
- **Companion Extension Support**: 1-click download handoff directly from Chrome, Edge, and Brave via custom protocol handling (`streamgrab://`).

---

## Tech Stack

| Layer | Component | Notes |
|---|---|---|
| **App Core** | [Tauri v2](https://v2.tauri.app/) + Rust | Native system integration, process isolation, deep links |
| **Frontend** | React / Svelte + TypeScript + Vite | Clean, responsive UI |
| **UI Kit** | Tailwind CSS + shadcn | Dark/light mode, modern aesthetics |
| **Engine Sidecars** | `yt-dlp` + `ffmpeg` | Robust format extraction & stream muxing |
| **State Store** | SQLite via `rusqlite` | Persistent download history and queue restoration |

---

## Project Architecture

```
                       [ Chromium Extension ]
                                 | (Custom URI: streamgrab://...)
                                 v
+------------------------------------------------------------------+
| StreamGrab Desktop App (Tauri v2)                                |
|                                                                  |
|   Frontend: Svelte / React + Vite                                |
|      ^                                                           |
|      | IPC (Commands & Streamed Events)                          |
|      v                                                           |
|   Rust Core:                                                     |
|      - Process Runner (Job Objects, graceful cancellation)       |
|      - Stdout Stream Parser (Progress / Speed / ETA)             |
|      - Sidecar Manager (%LOCALAPPDATA% updater)                  |
+------------------------------------------------------------------+
          |                                        |
          v                                        v
   [ yt-dlp.exe ]                            [ ffmpeg.exe ]
 (Metadata & Fetching)                     (Muxing & Audio Encoding)
```

---

## Roadmap & Milestones

### Phase 1: MVP (Windows Core)
- [ ] Scaffold Tauri v2 project structure with chosen frontend (Svelte or React).
- [ ] Configure `tauri.conf.json` external binaries for `yt-dlp` and `ffmpeg`.
- [ ] Implement Rust backend commands:
  - `fetch_metadata(url: String)`
  - `start_download(options: DownloadOptions)`
  - `cancel_download(task_id: String)`
- [ ] Implement stdout parsing and progress event streaming.
- [ ] Temporary staging (`.part` files) and atomic file completion.
- [ ] Self-updating mechanism for `yt-dlp` executable.

### Phase 2: Power Features & Companion
- [ ] Batch & playlist extraction.
- [ ] SQLite download history view with "Open in Folder" and "Re-download".
- [ ] Register Windows protocol handler (`streamgrab://`).
- [ ] Build and package the companion Chromium extension.
- [ ] SponsorBlock integration.

### Phase 3: Cross-Platform & Release
- [ ] Linux builds (`.AppImage`, `.deb`).
- [ ] Automated CI/CD pipeline via GitHub Actions.
- [ ] Code signing & release distribution.

---

## Development Prerequisites

1. **Rust toolchain**: Installed via [rustup.rs](https://rustup.rs/) (stable channel, `x86_64-pc-windows-msvc`).
2. **Node.js**: LTS version (v18 or v20+).
3. **C++ Build Tools**: Visual Studio C++ Build Tools installed.
4. **Sidecar Binaries**:
   - `yt-dlp.exe` placed in `src-tauri/bin/yt-dlp-x86_64-pc-windows-msvc.exe`
   - `ffmpeg.exe` placed in `src-tauri/bin/ffmpeg-x86_64-pc-windows-msvc.exe`

---

## License
Open source under the MIT License.

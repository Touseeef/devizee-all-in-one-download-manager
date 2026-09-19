# Software Requirements Specification (SRS)

## Project: Native Stream & Media Downloader (Tauri v2 + Rust)

**Document Version:** 1.0.0  
**Status:** Draft / Active  
**Target Platform:** Windows 10/11 (Phase 1), Linux (Phase 2), macOS (Phase 3)

---

### 1. Introduction

#### 1.1 Purpose
This document specifies the software requirements for a high-performance, lightweight, open-source desktop media downloader. The application pairs a modern web frontend with a native Rust backend powered by Tauri v2, orchestrating `yt-dlp` and `ffmpeg` as isolated sidecars.

#### 1.2 Scope
- Desktop application running natively on Windows with minimal memory footprint (< 100MB active).
- Format extraction, quality selection, video/audio stream multiplexing.
- Queue management, state persistence across restarts, and real-time progress streaming.
- Auto-updating extraction engine independent of host app releases.
- Companion browser extension integration via custom protocol or local loopback.

#### 1.3 Definitions & Acronyms
- **Sidecar:** An auxiliary native executable (`yt-dlp`, `ffmpeg`) bundled and executed by the host Tauri application.
- **Muxing (Multiplexing):** The process of interleaving separate high-resolution video streams and high-fidelity audio streams into a single container format (MP4/MKV) via FFmpeg.
- **DASH:** Dynamic Adaptive Streaming over HTTP (used by modern streaming platforms to split audio and video).
- **IPC:** Inter-Process Communication between the web frontend (Webview2) and Rust backend.

---

### 2. Overall Description

#### 2.1 Product Perspective
The system is an autonomous desktop utility operating entirely on client hardware. It does not act as a hosted service or proxy, avoiding intermediary copyright and hosting liability.

```
+-------------------------------------------------------------+
|                     Frontend (Vite / TypeScript)            |
|     [URL Input] -> [Format Selector] -> [Queue & Progress]  |
+-------------------------------------------------------------+
                              |
               Tauri IPC (Commands & Events)
                              |
+-------------------------------------------------------------+
|                      Rust Backend (Tauri Core)              |
|   - Sidecar Process Manager                                 |
|   - Stream Output Parser (Stdout -> Event Emitter)          |
|   - SQLite Local State Store (History & Queue)              |
|   - Engine Updater (Checks latest yt-dlp GitHub release)    |
+-------------------------------------------------------------+
               |                               |
       (Command Execution)             (Stream Muxing)
               v                               v
       [ yt-dlp.exe ]                   [ ffmpeg.exe ]
```

#### 2.2 User Classes
1. **Casual User:** Wants 1-click paste-and-download at highest available quality.
2. **Audio Archivist:** Downloads playlists or extracts high-bitrate audio (MP3/Opus/FLAC) with embedded metadata.
3. **Power User:** Configures custom format strings, subtitle inclusions, SponsorBlock filtering, and custom download locations.

---

### 3. Functional Requirements (FR)

#### 3.1 Input & Metadata Inspection
- **FR-1.1:** The system shall accept arbitrary media URLs via user paste or clipboard auto-detection.
- **FR-1.2:** The system shall query `yt-dlp --dump-json` to extract video title, thumbnail, duration, channel name, and full stream format listings within 3 seconds on standard connections.
- **FR-1.3:** The format selector shall present human-readable resolution tiers (4320p/8K, 2160p/4K, 1440p/2K, 1080p, 720p, 480p, 360p) alongside audio-only presets (Best Audio, MP3 320kbps, AAC, FLAC).

#### 3.2 Download & Muxing Engine
- **FR-2.1:** The system shall execute downloads to a temporary directory with `.part` staging extensions.
- **FR-2.2:** The system shall invoke `ffmpeg` to multiplex separate DASH video and audio streams into an MP4 or MKV container.
- **FR-2.3:** The system shall atomically rename verified completed files to the target user directory using customizable naming templates (e.g., `%(title)s [%(id)s].%(ext)s`).
- **FR-2.4:** The system shall verify file existence and non-zero byte sizing before marking any task as "Completed".

#### 3.3 Execution & Progress Monitoring
- **FR-3.1:** The Rust backend shall capture child process `stdout` line-by-line using `--newline` formatting and emit structured events to the frontend:
  ```json
  {
    "taskId": "uuid",
    "percent": 68.4,
    "speed": "14.2MiB/s",
    "eta": "00:23",
    "status": "downloading"
  }
  ```
- **FR-3.2:** The user shall be capable of pausing, resuming, and terminating active downloads without leaving zombie processes.

#### 3.4 Engine Self-Updating (Critical)
- **FR-4.1:** The application shall locate the active `yt-dlp` executable inside `%LOCALAPPDATA%` (not `Program Files`) to prevent permission errors during updates.
- **FR-4.2:** On startup (or manual trigger), the app shall check the GitHub Releases API for the latest `yt-dlp` release tag. If outdated, it shall download the new binary and atomically replace the active executable.

#### 3.5 Storage & History
- **FR-5.1:** All download history and unfinished queue states shall be stored in a local SQLite database (`downloads.db`).
- **FR-5.2:** Users shall be able to filter history by date/platform and click to open the containing folder in the system file explorer.

---

### 4. Non-Functional Requirements (NFR)

#### 4.1 Performance & Resource Footprint
- **NFR-1 (Binary Footprint):** The standalone installer shall not exceed 25MB (excluding bundled ffmpeg binary).
- **NFR-2 (Memory Overhead):** Idle memory footprint shall remain below 45MB. Peak memory during active parsing and UI rendering shall not exceed 100MB.
- **NFR-3 (Cold Start):** Cold launch time on Windows 10/11 with SSD shall be under 500ms.

#### 4.2 Reliability & Fault Tolerance
- **NFR-4 (Process Teardown):** When a download task is aborted, the backend must terminate the entire process tree (`yt-dlp` + `ffmpeg`) to prevent process leaks and locked file handles.
- **NFR-5 (Resumability):** Disrupted downloads (e.g., network timeout) shall resume using `yt-dlp`'s native chunk resumption without restarting from byte 0.

#### 4.3 Security & Privacy
- **NFR-6:** Zero telemetry or analytical tracking of downloaded URLs or user behavior.
- **NFR-7:** All network traffic for media extraction shall route directly from client to host endpoints with no intermediate proxy.

---

### 5. External Interfaces & Integration

#### 5.1 Tauri Plugin Shell / Sidecar Contract
- `yt-dlp` binary bundled with architecture-specific suffixes (e.g., `yt-dlp-x86_64-pc-windows-msvc.exe`).
- `ffmpeg` binary bundled for audio extraction and container muxing.

#### 5.2 Companion Browser Extension
- A Manifest V3 extension registering a toolbar icon and shortcut.
- Clicking the extension fires a registered OS deep link: `streamgrab://download?url=<ENCODED_URL>`.
- The native desktop app handles the protocol and automatically queues the URL.

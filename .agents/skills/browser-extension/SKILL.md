---
name: browser-extension
description: Architectural rules and integration specification for the Devizee Chromium Manifest V3 browser extension, Native Messaging host, and single-instance relay.
---

# Devizee Chromium Extension (Manifest V3) Specification

## 1. Role and Core Principles

The extension is a **fast detector and relay**, not a download engine.
- All actual network acceleration, segmented downloading, muxing, and format conversion are performed exclusively by Devizee's desktop backend (`direct-link-engine` via aria2c and `yt-dlp`).
- The extension does not open raw sockets or attempt multi-part downloading itself.
- It catches media links and browser downloads instantly, extracts relevant authentication cookies, and hands them off cleanly to the desktop application.

---

## 2. Distinct Capabilities

### Passive File Download Interception
- Hooks Chromium events: `chrome.downloads.onDeterminingFilename` and `chrome.downloads.onCreated`.
- **Gated behind a master setting toggle**: "Intercept Browser Downloads", **OFF by default** (privacy-first precedent).
- **Master Pause Control**: A prominent "Pause Link Grabbing" toggle allows the user to temporarily suspend all interception with one click.
- **Configurable Threshold & Excludes**: Applied only to downloads with file size >= threshold (default: 10 MB, user-configurable). Trivial small downloads (HTML files, thumbnails, small documents) and excluded domains are bypassed.
- **Handoff Mechanism**:
  1. Cancels the browser's internal download (`chrome.downloads.cancel(downloadItem.id)`).
  2. Extracts minimal relevant cookies for the origin domain via `chrome.cookies.getAll`.
  3. Relays URL and cookies to Devizee desktop via Native Messaging.

### Streaming Media Detection
- Monitors active tab navigation without injecting invasive content scripts.
- Matches hostnames against Devizee's supported streaming domain list.
- **Visual Badge Indicator**: When on a supported streaming page, the extension toolbar icon lights up with an accent badge (`"GET"`).
- **Context Menu Integration**: Right-clicking any page or link provides a dedicated "Download with Devizee" item.
- Reuses the `protocol-handler` URL contract.

---

## 3. Transport Architecture

### Primary Channel: Chrome Native Messaging
- Relies on Native Messaging Host (`com.devizee.native_host`).
- A companion relay script receives messages via standard I/O (32-bit length-prefixed JSON) and forwards payloads to the running Devizee instance.
- **Single-Instance Safety**: The desktop application is protected by `tauri-plugin-single-instance`. Launching or signaling Devizee forwards arguments (`--url <URL>`) to the existing running application window via Tauri events, focusing the window rather than spawning duplicate processes.

### Fallback Channel: Custom Protocol Handler
- If the Native Messaging host is unavailable or the app is cold-started:
  Dispatches to `streamgrab://download?url=<ENCODED_URL>`.

---

## 4. Security & Privacy Bounds

- **Input Sanitization**: Devizee desktop treats all incoming extension payloads as untrusted input. URLs are validated for structure and plausible supported schemes before execution.
- **Origin Lockdown**: The Native Messaging host manifest (`com.devizee.native_host.json`) restricts `allowed_origins` exclusively to Devizee's extension ID.
- **Data Minimization**: The extension transmits only the target URL and necessary session cookies required for authenticated media fetches. No browsing history or unrelated form data is captured or logged.

---
name: media-player
description: Authoritative specification for all media playback inside Devizee (video player, in-line audio preview, and Audio Hub). Use whenever touching media elements, volume controls, autoplay logic, or player keyboard shortcuts.
---

# Media Player Specification

## 1. Core Principles

### Single "Now Playing" Mutual Exclusivity
- Video and audio playback must **never** occur concurrently.
- Starting playback on any media source (video card, in-line audio preview, or Audio Hub offline track) must immediately pause/stop all other active media elements across the entire application.
- One centralized `nowPlaying: { type: "none" | "audio" | "video", id: string | null }` state represents the active player at all times.
- An animated status indicator (`Playing audio` or `Playing video`) is surfaced in the top bar branding when media is active.

### Consolidated Shared Volume
- Video, in-line audio previews, and Audio Hub must share **one unified volume state**.
- There is only one volume slider and one mute toggle in memory, persisted under `devizee_volume` in localStorage and synchronized with `settings.volume`.
- Any `<video>` or `<audio>` element mounted in the DOM must initialize its `.volume` to this shared state immediately on mount (`useEffect`).
- Native HTML5 video controls must attach `onVolumeChange` to synchronize adjustments back to the shared state, ensuring the custom slider and native controls never desync.

### Autoplay Gating
- Autoplay is gated behind a single setting: `settings.autoplay` (default: `false`).
- One setting governs both online streaming media and offline file playback.
- When `settings.autoplay` is `false`, analyzing a link, opening an item, or mounting a view displays metadata and thumbnail previews only — it must **never** start playback automatically.
- No view switch or tab switch (e.g., Downloads <-> Audio Hub <-> Settings) may ever trigger playback as a side effect. Playback requires an explicit user action (clicking Play, Listen, or pressing Space).

### Fullscreen Minimization Behavior
- The close button (`X`) and the `Escape` key inside fullscreen player mode must **minimize** (exit fullscreen via `document.exitFullscreen()`), returning to the normal inline view with playback running undisturbed.
- Closing inline player mode stops playback and restores the thumbnail preview.
- Both exit paths must route through the same unified function (`exitFullscreenAndKeepPlaying()`).

---

## 2. Keyboard Shortcuts Contract

When the main window or player is active (and the user is not actively typing inside an `<input>` or `<textarea>`):
- **`Space`**: Toggle Play / Pause for whichever media is active in `nowPlaying`.
- **`ArrowLeft`**: Seek backward by 5 seconds (`handleSeekRelative(-5)`).
- **`ArrowRight`**: Seek forward by 5 seconds (`handleSeekRelative(5)`).
- **`Escape`**: Exit fullscreen mode without interrupting playback.
- **`KeyM`**: Toggle mute/unmute (`toggleMute()`).

---

## 3. UI and Visual Language

- **Close/X Buttons**: Must use the design system icon-button pattern:
  `w-7 h-7 rounded-md bg-white/10 hover:bg-status-danger/80 text-white flex items-center justify-center transition-colors shadow-sm`.
- **"Listen" Button**: Rendered in the card header with the primary accent background (`bg-accent text-white px-3 py-1.5 font-semibold text-caption shadow-sm`).
- **Audio Scrubber Strip**: When "Listen" is clicked, the control bar sits directly on the scrubber track, flanked by `-5s` (`RotateCcw`), central `Play`/`Pause`, and `+5s` (`RotateCw`) jump controls.

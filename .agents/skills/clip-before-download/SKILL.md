---
name: clip-before-download
description: Use when implementing or updating the Clip-Before-Download trimming feature — range selectors, start/end timestamp parsing, and yt-dlp section downloading without fetching the full video file.
---

# Clip-Before-Download (Segment Trimming)

## What it is
A flagship USP of Devizee: users can specify a precise start timestamp (`01:15`) and end timestamp (`03:45`) to download only the required clip from a lengthy video (e.g., a 3-hour podcast, concert, or lecture), rather than wasting bandwidth and storage downloading gigabytes of unneeded media.

## Implementation Architecture

### Frontend Interface
- In the Video Card, a **"Trim Clip"** toggle button opens a sleek segment control bar.
- Dual time inputs or scrubbable range:
  - **Start Time**: `HH:MM:SS` or `MM:SS` (default: `00:00`)
  - **End Time**: `HH:MM:SS` or `MM:SS` (default: video total duration)
  - Quick buttons: "Set Start to Current Preview Position", "Set End to Current Preview Position", "Reset".
- Validation:
  - `start_seconds < end_seconds`
  - `end_seconds <= total_duration`

### Backend Engine Integration (`yt-dlp`)
- `yt-dlp` natively supports downloading partial segments directly from HTTP chunked streams without retrieving the entire file via:
  ```bash
  --download-sections "*FROM-TO"
  ```
  Example: `--download-sections "*00:01:30-00:04:15"`
- When combined with `--force-keyframes-at-cuts`, `yt-dlp` instructs `ffmpeg` to make precise cuts at the exact keyframes.
- If audio extraction is requested with trimming, `yt-dlp` rips only the audio from that trimmed segment and encodes to MP3/M4A/FLAC cleanly.

### Edge Cases
- **Live Streams**: Trimming from live streams requires valid archive playback or VOD availability. If a live stream is ongoing, warn the user that trimming applies only to recorded VODs.
- **Keyframe Accuracy**: Some platform streams have sparse keyframes (every 5-10 seconds). Always pass `--force-keyframes-at-cuts` so ffmpeg re-encodes boundary GOPs for sample-accurate cuts rather than frozen initial frames.

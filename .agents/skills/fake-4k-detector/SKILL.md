---
name: fake-4k-detector
description: Use when building or refining the Fake-4K and Upscale Detection feature — video bitrate heuristics, codec inspection, and visual quality indicators to warn users against downloading bloated upscaled streams.
---

# Fake-4K / Upscale Detector

## What it is
A flagship USP addressing a pervasive problem on streaming platforms (especially YouTube and social video sites): creators uploading 1080p footage upscaled to 3840x2160 (4K) solely to trigger the platform's higher-tier VP9/AV1 bitrate allotment, or platforms serving re-encoded streams that offer no genuine 4K spatial detail. Devizee analyzes stream metadata and alerts the user before they waste gigabytes on fake-4K video.

## Detection Heuristics

1. **Bitrate-to-Pixel Ratio (BPP)**:
   - Genuine 4K SDR typically requires `15 - 45 Mbps` (H.264) or `8 - 25 Mbps` (VP9/AV01) to carry true 4K spatial frequency.
   - If a `2160p` stream's video bitrate is `< 7,000 kbps` (7 Mbps) for H.264/VP9, it is almost certainly an upscale from a 1080p source.
   - Formula:
     $$\text{BPP} = \frac{\text{Bitrate (bits/sec)}}{\text{Width} \times \text{Height} \times \text{FPS}}$$
     Values below `0.04` for H.264 or `0.02` for AV1/VP9 at 4K resolution indicate severe compression or upscaled source.

2. **Source Dimension & Aspect Anomalies**:
   - Videos labeled 4K but with non-standard dimensions or where intermediate 1440p tiers are missing while 1080p bitrate is abnormally close to 2160p bitrate.

3. **FFprobe Frame Quality Probe (Deep Inspection - Optional)**:
   - When requested, ffprobe reads the first 100 frames to measure high-frequency DCT energy. Lack of high-frequency spatial coefficients confirms an upscaled 1080p master.

## UI Presentation
- In the Format Tier selector:
  - If a 4K stream passes: display regular badge: `4K (2160p Ultra HD)`.
  - If suspected upscale: display alert chip: `4K (⚠️ Suspected 1080p Upscale - 6.2 Mbps)`.
  - Hovering/clicking the warning tooltip explains: "Bitrate analysis suggests this video was upscaled from 1080p. Downloading in 1080p saves ~70% bandwidth with near-identical visual fidelity."
- Users can still download the 4K tier if they choose — Devizee informs rather than restricts.

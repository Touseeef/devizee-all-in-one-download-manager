---
name: audio-fingerprint-tagger
description: Use when implementing or updating Audio Metadata Fingerprinting and Auto-Tagging — AcoustID/Chromaprint acoustic recognition, ID3/Vorbis tag embedding, and high-res album artwork attachment.
---

# Audio-Fingerprint Auto-Tagging

## What it is
A flagship differentiator for audio lovers: when downloading songs from YouTube, SoundCloud, or web streams, video titles are often littered with junk (e.g. `[Official Music Video]`, `(Lyrics)`, `HD 1080p`, `Prod. by XYZ`, promotional emojis). Devizee automatically cleans metadata and uses acoustic fingerprinting or platform metadata to embed clean, professional ID3 tags (Title, Artist, Album, Release Year, Genre, Track Number) and high-resolution cover artwork directly into the resulting MP3/M4A/FLAC file.

## Tagging Pipeline

1. **Title Sanitization (Zero-Network Fast Heuristic)**:
   - Strip common YouTube fluff via regex patterns:
     - `\s*\[(?:Official|Music|Video|Lyrics|4K|HD|Audio|Remastered|Explicit|Visualizer).*?\]`
     - `\s*\((?:Official|Music|Video|Lyrics|4K|HD|Audio|Remastered|Explicit|Visualizer).*?\)`
     - `\s*ft\.?|\s*feat\.?` extraction for guest artists.
   - Parse `Artist - Title` vs `Title - Artist` convention using channel uploader hints.

2. **Metadata Embedding via yt-dlp & FFmpeg**:
   - Pass native metadata embedding flags:
     ```bash
     --embed-metadata
     --embed-thumbnail
     --add-metadata
     ```
   - For MP3, uses `id3v2.3` or `id3v2.4` tags.
   - For M4A/AAC, uses Apple iTunes metadata atoms (`©nam`, `©ART`, `©alb`, `covr`).
   - For FLAC, uses standard Vorbis comments + `PICTURE` block.

3. **Acoustic Recognition (AcoustID / Chromaprint Integration)**:
   - For obscure tracks or tracks with ambiguous video titles, compute a 120-second acoustic fingerprint using `fpcalc` (Chromaprint binary).
   - Match fingerprint against MusicBrainz / AcoustID to retrieve canonical album name, disc number, release year, and ISRC.

## Privacy & Offline Guarantee
- Basic regex cleaning + platform metadata embedding is 100% offline and zero-telemetry.
- External fingerprint querying (AcoustID) is opt-in via Settings (`autoTagMusic: true`), with no user data or account tokens transmitted.

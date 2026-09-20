---
name: ffmpeg-muxing
description: Use when wiring the ffmpeg stream-muxing step, audio-only extraction/conversion, embedded tags/cover art, or the .part staging and atomic rename flow. Covers FR-2.1 through FR-2.4.
---

# FFmpeg Muxing & Atomic Completion

## When to use
Any code path that combines DASH video+audio into MP4/MKV, converts to
MP3/AAC/FLAC/Opus, or finalizes a downloaded file.

## Staging flow (FR-2.1, FR-2.3, FR-2.4)
1. yt-dlp downloads separate video/audio fragments into a temp dir with a
   `.part` extension (yt-dlp does this natively when you pass an output
   template pointing at the temp dir — you don't need to hand-roll it).
2. ffmpeg is invoked with `-c copy` for the muxing step whenever container
   remux is enough (i.e. codecs are already compatible with the target
   container) — only re-encode when the user explicitly picked a format
   requiring transcoding (e.g. MP3 audio extraction). Re-encoding by
   default is the main reason naive implementations are slow.
3. After ffmpeg exits 0, verify the output file: non-zero byte size AND
   duration within a small tolerance of the metadata-reported duration
   (use `ffprobe` for this, it's bundled with ffmpeg). This is FR-2.4 —
   don't skip the duration check, byte-size alone doesn't catch a truncated
   mux that still produced a playable-looking header.
4. Only after verification passes: atomically rename (`std::fs::rename`,
   which is atomic on the same filesystem) from the temp path to the final
   user-chosen directory, applying the filename template (e.g.
   `%(title)s [%(id)s].%(ext)s`) with proper filesystem-illegal-character
   sanitization for Windows (`< > : " / \ | ? *`).
5. If verification fails, mark the task `error`, leave the `.part`/temp
   files for inspection (don't silently delete evidence of what broke),
   and surface a specific error code, not "download failed."

## Audio extraction (README "Audio Extraction" feature)
- Embed tags (title, artist/uploader, album=platform) and cover art via
  ffmpeg's `-metadata` flags and thumbnail attachment, not a separate
  post-processing library — one ffmpeg invocation, not two tools.
- Bitrate presets: expose "Best/320kbps/192kbps" rather than a raw kbps
  input field for the casual-user tier (FR user class 1); put arbitrary
  bitrate entry behind an "Advanced" toggle for the power-user tier.

## Anti-patterns to reject
- Re-encoding video when a `-c copy` remux would produce an equivalent
  output — wastes CPU and time for no quality gain.
- Renaming into place before ffmpeg's exit code AND ffprobe verification
  both pass.
- Hardcoding container choice — respect the user's MP4 vs MKV selection;
  MKV is required whenever the chosen codec combination isn't valid in MP4.

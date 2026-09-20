---
name: channel-subscriptions
description: Use when designing or implementing channel and playlist subscriptions — automated monitoring of creator channels, RSS/Atom feed polling, and rule-based auto-downloading of new uploads.
---

# Channel & Playlist Subscriptions (Phase 3)

## What it is
A natural extension of Devizee's `scheduler-and-rules` engine: users can subscribe to channels (YouTube, Vimeo, Twitch VODs, Soundcloud artists) or dynamic playlists. Devizee periodically monitors subscribed feeds and automatically downloads new uploads matching user-defined quality/format rules without requiring manual link submission.

## Architecture

1. **Subscription Store (SQLite Table `subscriptions`)**:
   - `id`: Unique subscription UUID.
   - `source_url`: Channel or playlist URL.
   - `channel_title`: Display title and avatar URL.
   - `poll_interval_minutes`: Check frequency (e.g. 60 min, 360 min, daily).
   - `last_checked_timestamp`: UNIX epoch of last successful crawl.
   - `quality_rule`: Filter criteria (e.g. "Video 1080p MP4", "Audio Only MP3", "Only if title contains 'Podcast'").
   - `auto_download`: Boolean toggle.

2. **Efficient Feed Polling**:
   - Instead of spinning up heavy full-page browser crawls, use lightweight platform feed endpoints (e.g. YouTube XML feeds: `https://www.youtube.com/feeds/videos.xml?channel_id=UC...` or `yt-dlp --playlist-end 5 --flat-playlist`).
   - Compare discovered video IDs against previously recorded IDs in `subscription_items`.
   - Dispatch new items directly into the scheduler queue according to active rules.

3. **Scheduler Integration**:
   - Downloads adhere to the user's concurrency limits, speed throttling, and scheduled night mode hours.

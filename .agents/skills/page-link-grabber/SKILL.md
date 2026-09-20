---
name: page-link-grabber
description: Use when building or extending the Page and Site Link Grabber feature — DOM crawling, link regex extraction, media asset batch filtering, and batch queue dispatch (closing the feature parity gap with Internet Download Manager).
---

# Page & Site Link Grabber (Phase 3)

## What it is
Closing the core functionality gap with Internet Download Manager (IDM)'s "Site Grabber": users can submit any webpage or article URL. Devizee analyzes the page's HTML, extracts all embedded media assets, downloadable links (MP4, MP3, PDF, ZIP, ISO, WEBM, M4V), groups them by category and file size, and allows one-click batch selection and queueing.

## Architecture

1. **Page Extraction Engine**:
   - Spawns a lightweight HTTP request with streaming response parser.
   - Collects `<a href>`, `<video src>`, `<audio src>`, `<source src>`, and regex matches on direct media file extensions.
   - Resolves relative URLs to absolute canonical URLs against the base URL.

2. **Categorization & Filtering**:
   - Categories: **Video**, **Audio**, **Documents & Archives**, **Images**.
   - Filters: By file extension (`.mp4`, `.pdf`, `.zip`), minimum file size (via `HEAD` requests for `Content-Length`), or keyword filter.

3. **Queue Dispatch**:
   - Selected items are pushed to `direct-link-engine` or `start_download` in batch with parallel concurrency rules.

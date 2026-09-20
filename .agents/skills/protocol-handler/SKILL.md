---
name: protocol-handler
description: Use when wiring the streamgrab:// deep link, the Manifest V3 companion extension, or anything registering/handling a custom OS protocol on Windows. Phase 2 feature — covers SRS section 5.2.
---

# Protocol Handler / Companion Extension Handoff

## When to use
Registering the `streamgrab://` URI scheme, handling incoming deep links in
the running (or cold-started) Tauri app, or building the browser extension
that fires them.

## Registration (Windows, Phase 1.5/2)
- Register the protocol at install time via the NSIS installer script (or
  Tauri's `tauri.conf.json` bundle config if v2 exposes a declarative hook
  for it) — writing raw registry keys by hand in Rust at first-run is
  fragile and can leave orphaned entries on uninstall. Prefer whatever the
  installer/bundler natively supports so uninstall cleans it up too.
- Handle both cases: app already running (protocol activation should just
  focus the window and queue the URL) and cold start (parse the protocol
  arg from `std::env::args()` on launch, same code path, then queue it
  once the UI is ready).

## URL contract
`streamgrab://download?url=<ENCODED_URL>` — the extension only ever sends
the *target video URL*, url-encoded. It should NOT send cookies or auth
tokens through this channel; if cookie-based auth is needed (age-restricted
content), that's a separate explicit user action inside the app (Advanced
> Import Cookies), not something the extension silently forwards. Treat any
protocol payload as untrusted input — validate it's a well-formed URL for
a supported platform before queuing, don't pass it straight to a shell
command.

## Extension side (Manifest V3)
- Toolbar icon + keyboard shortcut, background service worker constructs
  the deep link from `chrome.tabs.query`'s active tab URL, no content-script
  injection needed for the MVP version of this feature.
- No local server / loopback HTTP listener unless deep-link registration
  turns out to be unreliable in testing — a listening localhost port is a
  bigger security surface than a registered URI scheme and should be the
  fallback, not the default design.

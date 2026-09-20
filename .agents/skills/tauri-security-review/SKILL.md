---
name: tauri-security-review
description: Use before merging any change that spawns a process, accepts a URL/user input that reaches a shell command, or touches Tauri's allowlist/capabilities config. Covers NFR-6, NFR-7, and general command-injection hygiene for this project.
---

# Security Review Checklist (Sidecar + IPC Surface)

## When to use
Any PR touching: process spawning, the protocol handler, Tauri capabilities/
allowlist config, or anything that takes a user-supplied string (URL,
filename template, output path) and passes it to yt-dlp/ffmpeg or the
filesystem.

## Checklist
- [ ] User-supplied URL is passed to yt-dlp as a discrete process argument
      (e.g. `Command::new(...).arg(url)`), never interpolated into a shell
      string. This app should never call out to `sh -c` / `cmd /C` with a
      concatenated command.
- [ ] Filename templates are sanitized for path traversal (`../`) and
      Windows-illegal characters before being handed to yt-dlp's `-o`
      output template or used in a Rust `PathBuf`.
- [ ] Cookie file imports (Advanced feature) are read-only on disk, never
      logged, and not included in any crash report or diagnostic export.
- [ ] Tauri v2 capabilities file grants only the specific commands each
      window actually needs — don't grant a broad shell/fs capability to
      the whole app when only the download-queue window needs it.
- [ ] No network call exists in the codebase other than: (a) requests to
      the platform being downloaded from, initiated by yt-dlp itself, and
      (b) the yt-dlp GitHub Releases API check in the engine-updater skill.
      Grep for stray `fetch`/`reqwest` calls before merging — this is
      NFR-6/NFR-7 and is a stated open-source trust commitment in the
      README, not just an internal preference.
- [ ] The `streamgrab://` deep-link payload (if this PR touches it) is
      validated as a well-formed URL for a known supported platform before
      it reaches any download-triggering code path.
- [ ] Process teardown on cancel kills the full tree (see sidecar-manager
      skill) — an orphaned process is also a minor security/resource
      concern, not just a UX bug.

## Not in scope for this skill
Code-signing and installer trust (that's a Phase 3 release-engineering
task per the README roadmap, not a per-PR review item).

# AGENTS.md — Devizee (All-In-One Download Manager)

Read this before making any change. This file is always loaded; the
`.agents/skills/*/SKILL.md` files are loaded on demand when relevant.

## What this project is
Tauri v2 + Rust desktop app. Frontend in TypeScript/Vite (React or Svelte —
check `package.json` before assuming). `yt-dlp` and `ffmpeg` run as sidecar
binaries, never as in-browser/WASM logic. Reference `SRS.md` and `README.md`
in the repo root for full functional/non-functional requirements — FR/NFR IDs
in commit messages and PR descriptions should point back to those (e.g.
"Implements FR-2.2").

## Non-negotiable architecture rules
- All process spawning (yt-dlp, ffmpeg) happens in Rust (`src-tauri/`), never
  in frontend JS. The frontend only calls Tauri `invoke()` commands and
  listens for emitted events.
- Sidecar binaries live under `src-tauri/bin/` with target-triple suffixes
  (e.g. `yt-dlp-x86_64-pc-windows-msvc.exe`) per Tauri's sidecar convention —
  never hardcode a bare filename.
- The *active*, self-updating copy of `yt-dlp` lives in `%LOCALAPPDATA%`
  (Windows) / `$XDG_DATA_HOME` (future Linux phase), not inside the install
  directory — see FR-4.1. Never write to `Program Files` at runtime.
- Downloads land in a temp dir with a `.part` suffix and are atomically
  renamed only after a non-zero-size + duration sanity check passes
  (FR-2.4). Never mark a task "Completed" before that check runs.
- Killing a task must kill the whole process tree (yt-dlp *and* its child
  ffmpeg), not just the parent PID — this is NFR-4 and the most common bug
  source in every prior-art yt-dlp GUI. On Windows use Job Objects.

## Stack facts (don't re-litigate these)
- Desktop shell: Tauri v2, Rust backend
- Frontend: TS + Vite, Tailwind + shadcn
- Persistence: SQLite via `rusqlite`, file `downloads.db`
- Zero telemetry, zero analytics, no intermediary proxy for media traffic
  (NFR-6, NFR-7) — do not add any network call that isn't either (a) to the
  platform being downloaded from, or (b) the yt-dlp GitHub Releases API for
  self-update checks.

## Coding conventions
- Rust: `cargo fmt` + `clippy` clean before any commit. Tauri commands return
  `Result<T, String>` (or a typed error enum) — never `.unwrap()` inside a
  command handler that a user action can trigger.
- Progress events emitted from Rust → frontend must match the FR-3.1 JSON
  shape exactly: `{ taskId, percent, speed, eta, status }`. Don't invent new
  fields without updating SRS.md.
- Frontend: functional components, no class components. Tailwind utility
  classes only — no separate CSS files unless a library requires it.

## When you're unsure
If a request conflicts with SRS.md or README.md, say so and point at the
specific FR/NFR line rather than silently picking one interpretation.

# Devizee - Project Status Report

## 1. Project Snapshot
- **Branch**: main
- **Status**: Uncommitted changes (UI overhaul, notifications implementation). Up to date with origin/main.
- **Tech Stack**:
  - Tauri: v2 (tauri-cli ^2, @tauri-apps/api ^2)
  - Rust/Cargo: v1.85.0 (managed by Tauri / Rustup)
  - Node: v24.21.0
  - React: ^19.1.0
  - Vite: ^8.0.16
  - Tailwind CSS: ^4.3.3

## 2. Architecture As-Built

### File Tree
```text
src-tauri/src/
├── main.rs
├── lib.rs
├── db.rs
└── status.rs

src/
├── App.tsx
├── App.css
├── main.tsx
├── status.ts
└── vite-env.d.ts
```

### Backend (`src-tauri/src/`)
- **`main.rs`**: Standard Tauri v2 bootstrapper. Simply calls `devizee_all_in_one_download_manager_lib::run()`.
- **`lib.rs`**: Core backend logic. Sets up Tauri builder, initializes SQLite (`db.rs`), manages the `AppState`, and registers plugins (`opener`, `notification`, `clipboard-manager`). Contains commands: `analyze_url` (spawns `yt-dlp -J`), `fetch_playlist_info` (spawns `yt-dlp --flat-playlist -J`), and `start_download` (spawns `yt-dlp` for downloading, handles concurrent stderr/stdout draining, parses progress, updates SQLite, and emits events).
- **`db.rs`**: Handles SQLite persistence. Defines `DownloadRecord`, `init_db()`, `insert_download()`, `update_download_status()`, and fetches history. Maps `hidden` field for soft deletes.
- **`status.rs`**: Defines the strict 11-state `DownloadStatus` enum (Queued, Starting, Downloading, Muxing, Completed, Error, etc.) ensuring type-safety across the FFI boundary.

### Frontend (`src/`)
- **`App.tsx`**: The massive primary React component. Manages the Floating Sidebar layout (Dribbble/Mint aesthetic). Handles URL input, playlist prompt UI (Single Video vs Load Playlist), batch selection UI, vibrant Video Info card. Uses Tauri `invoke` and `listen` to track progress and sync with SQLite history. Contains the `flushNotifications` debouncer logic using `@tauri-apps/plugin-notification` to ping the native OS on batch completions/errors.
- **`App.css`**: Tailwind v4 configuration directly using `@theme` variables. Completely overhauled to a vibrant, soft, rounded Light/Mint UI, overriding the previous dark/Obsidian constraints.
- **`status.ts`**: TypeScript equivalent of `status.rs`. Contains exhaustive `STATUS_DISPLAY` mapping to UI colors, labels, and terminal states.

## 3. Roadmap Status

- **design-system**: *Deviated.* The skill dictates strict Apple HIG / Linear.app dark mode styling (Obsidian vibes, surface-1 backgrounds). The codebase completely contradicts this, now using a Dribbble-style light/mint theme with heavy gradients, giant border radii (32px), and colored soft shadows.
- **system-notifications**: *Fully Implemented.* Notifications are debounced and coalesced in `App.tsx` (using a 2-second flush window) via `@tauri-apps/plugin-notification`.
- **clipboard-radar**: *Not Started.* We added `@tauri-apps/plugin-clipboard-manager` to dependencies, but polling logic and the floating HUD window are unwritten.
- **sqlite-history**: *Fully Implemented.* `downloads.db` persists tasks, tracks statuses, handles soft deletes, and restores state on boot.
- **subprocess-reliability**: *Partially Implemented.* Concurrent draining of stdout/stderr prevents pipe deadlocks. Missing the Windows Job Objects implementation for killing orphaned ffmpeg instances on exit (flagged in `AGENTS.md` as NFR-4).
- **status-model**: *Fully Implemented.* 11-state enum synced between Rust and React.
- **ytdlp-progress-parser**: *Fully Implemented.* Custom `--progress-template` in `yt-dlp` feeds the frontend.
- **ffmpeg-muxing**: *Partially Implemented.* Handled natively by `yt-dlp`, but explicit error surfacing/custom UI state for "Muxing" is present.
- **engine-updater**, **scheduler-and-rules**, **direct-link-engine**, **protocol-handler**, **sidecar-manager**, **tauri-security-review**: *Not Started.*

## 4. Known Issues & Open Bugs

1. **`Stdio::null()` Workaround**: In `lib.rs:327`, `cmd.stdin(Stdio::null())` is used to prevent `yt-dlp` hanging on interactive prompts (e.g., overwrite prompts). It was a temporary fix to unblock downloads.
2. **Missing Job Objects (NFR-4)**: Killing the Tauri app does not reliably kill orphaned child processes (`yt-dlp` / `ffmpeg`) on Windows because Job Objects are not implemented.
3. **Hardcoded yt-dlp Paths**: Currently expects `yt-dlp.exe` and `ffmpeg.exe` to be exactly in the current directory or a relative path in `analyze_url`/`start_download` (via `current_dir()`), rather than properly using Tauri's sidecar path resolution `app.path().resource_dir()`.
4. **Clipboard Radar Missing**: The `clipboard-radar` skill was requested by the user, the plugin is installed, but the HUD and polling logic are non-existent.

## 5. What Changed Most Recently

1. Overhauled UI to Mint/Light theme (App.tsx, App.css) abandoning the Dark/HIG design.
2. Implemented `system-notifications` with batch coalescing in React via `@tauri-apps/plugin-notification`.
3. Registered `tauri-plugin-notification` and `tauri-plugin-clipboard-manager` in `Cargo.toml` and `lib.rs`.
4. Fixed Rust compilation errors (`serde` duplicate import, `try_state` Option/Result mismatch, unused `PathBuf` import).
5. Added interactive Playlist Batch Selection UI allowing users to fetch a playlist, check multiple boxes, and download concurrently.
6. Rewrote `App.tsx` into a modern Collapsible/Floating Sidebar layout.
7. Rewrote `App.css` to inject `tokens.css` variables, configuring Tailwind v4 theming.
8. Integrated `rusqlite` with `bundled` feature for local database persistence.
9. Implemented strict `DownloadStatus` 11-state enum in `status.rs` and `status.ts`.
10. Fixed yt-dlp subprocess deadlock by concurrently draining `stderr` and `stdout` threads instead of letting OS buffers fill up.
11. Passed `--concurrent-fragments 4` to `yt-dlp` for accelerated DASH/HLS downloading.

## 6. Full Contents of Key Files

### \`src-tauri/Cargo.toml\`
```toml
[package]
name = "devizee-all-in-one-download-manager"
version = "0.1.0"
description = "A Tauri App"
authors = ["you"]
edition = "2021"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[lib]
# The `_lib` suffix may seem redundant but it is necessary
# to make the lib name unique and wouldn't conflict with the bin name.
# This seems to be only an issue on Windows, see https://github.com/rust-lang/cargo/issues/8519
name = "devizee_all_in_one_download_manager_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-notification = "2"
tauri-plugin-clipboard-manager = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31.0", features = ["bundled"] }


# Read the optimization guideline for more details: https://tauri.app/concept/size/#cargo-configuration
[profile.release]
codegen-units = 1
lto = true
opt-level = 3
panic = "abort"
strip = true

```

### \`src-tauri/tauri.conf.json\`
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "devizee-all-in-one-download-manager",
  "version": "0.1.0",
  "identifier": "com.devizee.downloadmanager",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Devizee — All-In-One Download Manager",
        "width": 980,
        "height": 680,
        "minWidth": 820,
        "minHeight": 580
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": [
      "bin/yt-dlp",
      "bin/ffmpeg"
    ],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}

```

### \`src-tauri/src/lib.rs\`
```rust
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

mod status;
mod db;
use status::DownloadStatus;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Structure representing a clean, selectable format option for the user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatOption {
    pub format_id: String,
    pub label: String,
    pub ext: String,
    pub is_audio_only: bool,
    pub resolution: Option<String>,
    pub filesize_approx: Option<u64>,
}

/// Normalized video metadata returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: String,
    pub duration: Option<u64>,
    pub duration_string: String,
    pub uploader: String,
    pub formats: Vec<FormatOption>,
}

/// Progress event emitted to the frontend in real time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub task_id: String,
    pub percent: f32,
    pub speed: String,
    pub eta: String,
    pub status: DownloadStatus,
    pub error_code: Option<String>,
    pub error: Option<String>,
    pub file_path: Option<String>,
}

/// Helper function to locate the active yt-dlp executable (Absolute Paths)
fn get_yt_dlp_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().unwrap_or_default();

    if let Ok(local_data) = app.path().app_local_data_dir() {
        let updated_bin = local_data.join("bin").join("yt-dlp.exe");
        if updated_bin.exists() {
            return Ok(updated_bin);
        }
    }

    let dev_bin = cwd.join("bin").join("yt-dlp-x86_64-pc-windows-msvc.exe");
    if dev_bin.exists() {
        return Ok(dev_bin);
    }

    let dev_bin_parent = cwd.join("src-tauri").join("bin").join("yt-dlp-x86_64-pc-windows-msvc.exe");
    if dev_bin_parent.exists() {
        return Ok(dev_bin_parent);
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let prod_bin = resource_dir.join("bin").join("yt-dlp-x86_64-pc-windows-msvc.exe");
        if prod_bin.exists() {
            return Ok(prod_bin);
        }
        let prod_plain = resource_dir.join("bin").join("yt-dlp.exe");
        if prod_plain.exists() {
            return Ok(prod_plain);
        }
    }

    Ok(PathBuf::from("yt-dlp"))
}

/// Helper function to locate the ffmpeg binary (Absolute Paths)
fn get_ffmpeg_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let cwd = std::env::current_dir().unwrap_or_default();

    let dev_bin = cwd.join("bin").join("ffmpeg-x86_64-pc-windows-msvc.exe");
    if dev_bin.exists() {
        return Some(dev_bin);
    }

    let dev_bin_parent = cwd.join("src-tauri").join("bin").join("ffmpeg-x86_64-pc-windows-msvc.exe");
    if dev_bin_parent.exists() {
        return Some(dev_bin_parent);
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let prod_bin = resource_dir.join("bin").join("ffmpeg-x86_64-pc-windows-msvc.exe");
        if prod_bin.exists() {
            return Some(prod_bin);
        }
    }

    None
}

/// Tauri command to inspect any URL and extract metadata & format tiers
#[tauri::command]
async fn fetch_video_info(url: String, app: tauri::AppHandle) -> Result<VideoInfo, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;

    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args([
        "--dump-single-json",
        "--no-playlist",
        "--skip-download",
        "--no-warnings",
        "--compat-options",
        "no-youtube-unavailable-videos",
        &url,
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| {
        format!(
            "Failed to execute yt-dlp at {:?}: {}",
            yt_dlp_path,
            e.to_string()
        )
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let cleaned_error = stderr
            .lines()
            .find(|line| line.starts_with("ERROR:"))
            .unwrap_or(&stderr)
            .to_string();
        return Err(cleaned_error);
    }

    let json_val: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse metadata JSON: {}", e))?;

    let id = json_val["id"].as_str().unwrap_or("unknown").to_string();
    let title = json_val["title"].as_str().unwrap_or("Untitled Video").to_string();
    let thumbnail = json_val["thumbnail"].as_str().unwrap_or("").to_string();
    let duration = json_val["duration"].as_u64();
    let uploader = json_val["uploader"]
        .as_str()
        .or_else(|| json_val["channel"].as_str())
        .unwrap_or("Unknown Uploader")
        .to_string();

    let duration_string = match duration {
        Some(secs) => {
            let h = secs / 3600;
            let m = (secs % 3600) / 60;
            let s = secs % 60;
            if h > 0 {
                format!("{:02}:{:02}:{:02}", h, m, s)
            } else {
                format!("{:02}:{:02}", m, s)
            }
        }
        None => "--:--".to_string(),
    };

    let mut formats: Vec<FormatOption> = Vec::new();

    // -- RECOMMENDED (Top 3) --
    formats.push(FormatOption {
        format_id: "bestvideo+bestaudio/best".to_string(),
        label: "Best Quality (Auto-Mux)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("Max".to_string()),
        filesize_approx: None,
    });

    formats.push(FormatOption {
        format_id: "bestvideo[height<=1080]+bestaudio/best[height<=1080]".to_string(),
        label: "Full HD (1080p)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("1080p".to_string()),
        filesize_approx: None,
    });

    formats.push(FormatOption {
        format_id: "bestaudio/best".to_string(),
        label: "Audio Only (MP3 320k)".to_string(),
        ext: "mp3".to_string(),
        is_audio_only: true,
        resolution: None,
        filesize_approx: None,
    });

    // -- MORE QUALITIES --
    formats.push(FormatOption {
        format_id: "bestvideo[height<=720]+bestaudio/best[height<=720]".to_string(),
        label: "HD (720p)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("720p".to_string()),
        filesize_approx: None,
    });

    formats.push(FormatOption {
        format_id: "bestvideo[height<=2160]+bestaudio/best[height<=2160]".to_string(),
        label: "4K (2160p)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("2160p".to_string()),
        filesize_approx: None,
    });

    formats.push(FormatOption {
        format_id: "bestvideo[height<=1440]+bestaudio/best[height<=1440]".to_string(),
        label: "2K (1440p)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("1440p".to_string()),
        filesize_approx: None,
    });

    formats.push(FormatOption {
        format_id: "bestaudio/best".to_string(),
        label: "Lossless Audio (FLAC/Opus)".to_string(),
        ext: "flac".to_string(),
        is_audio_only: true,
        resolution: None,
        filesize_approx: None,
    });

    Ok(VideoInfo {
        id,
        title,
        url,
        thumbnail,
        duration,
        duration_string,
        uploader,
        formats,
    })
}

/// Tauri command to trigger a download and stream stdout progress events
#[tauri::command]
async fn start_download(
    task_id: String,
    url: String,
    title: String,
    format_id: String,
    is_audio_only: bool,
    ext: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;
    let ffmpeg_path_opt = get_ffmpeg_path(&app);

    let download_dir = app.path().download_dir().unwrap_or_else(|_| PathBuf::from(".")).join("Devizee");
    if !download_dir.exists() {
        let _ = std::fs::create_dir_all(&download_dir);
    }

    let out_template = download_dir.join("%(title)s [%(id)s].%(ext)s");
    let out_template_str = out_template.to_string_lossy().to_string();

    let task_id_clone = task_id.clone();
    let app_clone = app.clone();

    // Insert into DB
    let record = db::DownloadRecord {
        id: task_id.clone(),
        url: url.clone(),
        title: title.clone(),
        file_path: None,
        status: DownloadStatus::Queued,
        percent: 0.0,
        format: format_id.clone(),
        date_added: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64,
        hidden: false,
    };
    if let Some(state) = app.try_state::<AppState>() {
        let conn = state.db_conn.lock().unwrap();
        let _ = db::insert_download(&conn, &record);
    }

    std::thread::spawn(move || {
        let mut cmd = Command::new(&yt_dlp_path);
        let progress_template = "DEVIZEE_PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s";

        cmd.args([
            "--newline",
            "--progress-template", progress_template,
            "-o", &out_template_str,
            "--force-overwrites",
            "--no-playlist",
            "--no-warnings",
            "--concurrent-fragments", "4",
            "--compat-options", "no-youtube-unavailable-videos",
        ]);

        if is_audio_only {
            cmd.args(["-x", "--audio-format", &ext, "--audio-quality", "0"]);
        } else {
            cmd.args(["-f", &format_id, "--merge-output-format", &ext]);
        }

        if let Some(ref ffmpeg_path) = ffmpeg_path_opt {
            cmd.arg("--ffmpeg-location");
            cmd.arg(ffmpeg_path);
        }

        cmd.arg(&url);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);

        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped()); // Restore piped, but we will drain it

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let _ = app_clone.emit("download-progress", DownloadProgressPayload {
                    task_id: task_id_clone.clone(), percent: 0.0, speed: "0 B/s".to_string(), eta: "--".to_string(),
                    status: DownloadStatus::Error, error_code: Some("spawn_failed".to_string()), error: Some(e.to_string()), file_path: None,
                });
                if let Some(state) = app_clone.try_state::<AppState>() {
                    let conn = state.db_conn.lock().unwrap();
                    let _ = db::update_download_status(&conn, &task_id_clone, &DownloadStatus::Error, 0.0, None);
                }
                return;
            }
        };

        let _ = app_clone.emit("download-progress", DownloadProgressPayload {
            task_id: task_id_clone.clone(), percent: 0.0, speed: "Booting engine...".to_string(), eta: "Waiting for connection".to_string(),
            status: DownloadStatus::Starting, error_code: None, error: None, file_path: None,
        });

        // Drain stderr concurrently to prevent deadlock
        let stderr = child.stderr.take().unwrap();
        let error_logs = Arc::new(Mutex::new(Vec::new()));
        let error_logs_clone = error_logs.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let mut logs = error_logs_clone.lock().unwrap();
                logs.push(line);
            }
        });

        let mut final_file_path = None;
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            for line in reader.lines().flatten() {
                if line.contains("DEVIZEE_PROGRESS:") {
                    let parts_str = line.replace("DEVIZEE_PROGRESS:", "");
                    let parts: Vec<&str> = parts_str.split('|').collect();
                    if parts.len() >= 3 {
                        let percent_str = parts[0].trim().replace('%', "");
                        let percent: f32 = percent_str.parse().unwrap_or(0.0);
                        let speed = parts[1].trim().to_string();
                        let eta = parts[2].trim().to_string();

                        let status = if percent >= 100.0 { DownloadStatus::Muxing } else { DownloadStatus::Downloading };

                        let _ = app_clone.emit("download-progress", DownloadProgressPayload {
                            task_id: task_id_clone.clone(), percent, speed, eta, status: status.clone(), error_code: None, error: None, file_path: None,
                        });
                        if let Some(state) = app_clone.try_state::<AppState>() {
                            let conn = state.db_conn.lock().unwrap();
                            let _ = db::update_download_status(&conn, &task_id_clone, &status, percent, None);
                        }
                    }
                } else if line.contains("Destination:") {
                    let fp = line.replace("[download] Destination:", "").trim().to_string();
                    final_file_path = Some(fp);
                } else if line.contains("has already been downloaded") {
                    let fp = line.replace("[download]", "").replace("has already been downloaded", "").trim().to_string();
                    final_file_path = Some(fp);
                } else if line.contains("Merging formats into") {
                    let fp = line.replace("[Merger] Merging formats into", "").trim().trim_matches('"').to_string();
                    final_file_path = Some(fp);
                }
            }
        }

        let status = child.wait().unwrap();
        
        if status.success() {
            let _ = app_clone.emit("download-progress", DownloadProgressPayload {
                task_id: task_id_clone.clone(), percent: 100.0, speed: "Done".to_string(), eta: "".to_string(),
                status: DownloadStatus::Completed, error_code: None, error: None, file_path: final_file_path.clone(),
            });
            if let Some(state) = app_clone.try_state::<AppState>() {
                let conn = state.db_conn.lock().unwrap();
                let _ = db::update_download_status(&conn, &task_id_clone, &DownloadStatus::Completed, 100.0, final_file_path.as_deref());
            }
        } else {
            let logs = error_logs.lock().unwrap().join("\n");
            let _ = app_clone.emit("download-progress", DownloadProgressPayload {
                task_id: task_id_clone.clone(), percent: 0.0, speed: "".to_string(), eta: "".to_string(),
                status: DownloadStatus::Error, error_code: Some("unknown".to_string()), error: Some(logs), file_path: None,
            });
            if let Some(state) = app_clone.try_state::<AppState>() {
                let conn = state.db_conn.lock().unwrap();
                let _ = db::update_download_status(&conn, &task_id_clone, &DownloadStatus::Error, 0.0, None);
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Clone, Serialize)]
pub struct PlaylistEntry {
    pub id: String,
    pub title: String,
    pub url: String,
}

#[derive(Clone, Serialize)]
pub struct PlaylistInfo {
    pub id: String,
    pub title: String,
    pub uploader: String,
    pub entries: Vec<PlaylistEntry>,
}

#[tauri::command]
async fn fetch_playlist_info(url: String, app: tauri::AppHandle) -> Result<PlaylistInfo, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;

    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args([
        "--dump-single-json",
        "--flat-playlist",
        "--no-warnings",
        "--compat-options",
        "no-youtube-unavailable-videos",
        &url,
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let json_val: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let id = json_val["id"].as_str().unwrap_or("unknown").to_string();
    let title = json_val["title"].as_str().unwrap_or("Untitled Playlist").to_string();
    let uploader = json_val["uploader"]
        .as_str()
        .or_else(|| json_val["channel"].as_str())
        .unwrap_or("Unknown")
        .to_string();

    let mut entries = Vec::new();
    if let Some(entries_arr) = json_val["entries"].as_array() {
        for entry in entries_arr {
            let entry_id = entry["id"].as_str().unwrap_or("").to_string();
            let entry_title = entry["title"].as_str().unwrap_or("Unknown Title").to_string();
            let entry_url = entry["url"].as_str().unwrap_or("").to_string();
            
            let final_url = if entry_url.is_empty() && !entry_id.is_empty() {
                format!("https://www.youtube.com/watch?v={}", entry_id)
            } else {
                entry_url
            };

            if !entry_id.is_empty() {
                entries.push(PlaylistEntry {
                    id: entry_id,
                    title: entry_title,
                    url: final_url,
                });
            }
        }
    }

    Ok(PlaylistInfo {
        id,
        title,
        uploader,
        entries,
    })
}

struct AppState {
    db_conn: std::sync::Mutex<rusqlite::Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let conn = db::init_db(&app.handle()).expect("Failed to initialize database");
            app.manage(AppState {
                db_conn: std::sync::Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_video_info,
            fetch_playlist_info,
            start_download,
            open_folder,
            get_history,
            hide_history_item,
            delete_history_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_history(state: tauri::State<AppState>) -> Result<Vec<db::DownloadRecord>, String> {
    let conn = state.db_conn.lock().unwrap();
    
    // Fetch and check if files are missing
    let mut records = db::get_all_downloads(&conn).map_err(|e| e.to_string())?;
    for record in &mut records {
        if record.status == DownloadStatus::Completed {
            if let Some(ref path) = record.file_path {
                if !std::path::Path::new(path).exists() {
                    record.status = DownloadStatus::Missing;
                    let _ = db::update_download_status(&conn, &record.id, &DownloadStatus::Missing, record.percent, Some(path));
                }
            }
        }
    }
    Ok(records)
}

#[tauri::command]
fn hide_history_item(id: String, state: tauri::State<AppState>) -> Result<(), String> {
    let conn = state.db_conn.lock().unwrap();
    db::hide_download(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_history_file(id: String, file_path: String, state: tauri::State<AppState>) -> Result<(), String> {
    let conn = state.db_conn.lock().unwrap();
    let path = std::path::Path::new(&file_path);
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
    db::hide_download(&conn, &id).map_err(|e| e.to_string())
}

```

### \`package.json\`
```json
{
  "name": "devizee-all-in-one-download-manager",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-clipboard-manager": "^2.3.3",
    "@tauri-apps/plugin-notification": "^2.4.0",
    "@tauri-apps/plugin-opener": "^2",
    "clsx": "^2.1.1",
    "lucide-react": "^1.47.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tailwind-merge": "^3.7.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@tauri-apps/cli": "^2",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^6.0.2",
    "autoprefixer": "^10.6.1",
    "postcss": "^8.5.28",
    "tailwindcss": "^4.3.3",
    "typescript": "~6.0.3",
    "vite": "^8.0.16"
  }
}

```

### \`src/App.tsx\`
```tsx
import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { 
  Download, Music, Settings, Search, X, Folder, MoreVertical, 
  Trash2, AlertTriangle, AlertCircle, PlayCircle, Loader2, FileWarning
} from "lucide-react";
import { TaskStatus, STATUS_DISPLAY, ERROR_MESSAGES } from "./status";

type FormatOption = {
  format_id: string;
  label: string;
  ext: string;
  is_audio_only: bool;
  resolution: string | null;
  filesize_approx: number | null;
};

type VideoInfo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration_string: string;
  uploader: string;
  formats: FormatOption[];
};

type DownloadRecord = {
  id: string;
  url: string;
  title: string;
  file_path: string | null;
  status: TaskStatus;
  percent: number;
  format: string;
  date_added: number;
};

export default function App() {
  const [activeTab, setActiveTab] = useState("downloads");
  const [url, setUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  
  // Playlist states
  const [isPlaylistPrompt, setIsPlaylistPrompt] = useState(false);
  const [playlistInfo, setPlaylistInfo] = useState<any>(null);
  const [selectedPlaylistItems, setSelectedPlaylistItems] = useState<Set<string>>(new Set());
  
  // Current active tasks combined with history
  const [history, setHistory] = useState<DownloadRecord[]>([]);

  // Notification Coalescing
  const completedBatch = useRef<string[]>([]);
  const errorBatch = useRef<string[]>([]);
  const notificationTimer = useRef<any>(null);

  const flushNotifications = async () => {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    if (!granted) return;

    const comps = completedBatch.current.length;
    const errs = errorBatch.current.length;
    
    if (comps > 0) {
      sendNotification({
        title: 'Devizee',
        body: comps === 1 ? '1 download completed successfully.' : `${comps} downloads completed successfully.`,
      });
    }
    if (errs > 0) {
      sendNotification({
        title: 'Devizee Error',
        body: errs === 1 ? '1 download failed.' : `${errs} downloads failed. View queue for details.`,
      });
    }

    completedBatch.current = [];
    errorBatch.current = [];
  };

  const loadHistory = async () => {
    try {
      const recs: DownloadRecord[] = await invoke("get_history");
      setHistory(recs);
    } catch (e) {
      console.error("Failed to load history", e);
    }
  };

  useEffect(() => {
    loadHistory();

    const unlisten = listen<any>("download-progress", (event) => {
      const p = event.payload;
      
      setHistory(prev => {
        const idx = prev.findIndex(r => r.id === p.task_id);
        const oldStatus = idx !== -1 ? prev[idx].status : null;
        
        // Trigger notification on newly terminal state
        if (p.status === 'completed' && oldStatus !== 'completed') {
          completedBatch.current.push(p.task_id);
          clearTimeout(notificationTimer.current);
          notificationTimer.current = setTimeout(flushNotifications, 2000);
        } else if (p.status === 'error' && oldStatus !== 'error') {
          errorBatch.current.push(p.task_id);
          clearTimeout(notificationTimer.current);
          notificationTimer.current = setTimeout(flushNotifications, 2000);
        }

        if (idx === -1) {
          loadHistory();
          return prev;
        }
        
        const newHistory = [...prev];
        newHistory[idx] = {
          ...newHistory[idx],
          status: p.status,
          percent: p.percent,
          file_path: p.file_path || newHistory[idx].file_path,
        };
        return newHistory;
      });
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setFetchError("");
    setVideoInfo(null);
    setPlaylistInfo(null);

    if (url.includes("playlist?list=") || url.includes("&list=")) {
      setIsPlaylistPrompt(true);
      return;
    }

    await loadSingleVideo(url);
  };

  const loadSingleVideo = async (targetUrl: string) => {
    setIsPlaylistPrompt(false);
    setIsFetching(true);
    setFetchError("");
    try {
      const info: VideoInfo = await invoke("fetch_video_info", { url: targetUrl });
      setVideoInfo(info);
    } catch (err: any) {
      setFetchError(err.toString());
    } finally {
      setIsFetching(false);
    }
  };

  const loadPlaylist = async () => {
    setIsPlaylistPrompt(false);
    setIsFetching(true);
    setFetchError("");
    try {
      const info: any = await invoke("fetch_playlist_info", { url });
      setPlaylistInfo(info);
      setSelectedPlaylistItems(new Set(info.entries.map((e: any) => e.id)));
    } catch (err: any) {
      setFetchError(err.toString());
    } finally {
      setIsFetching(false);
    }
  };

  const handleStartDownload = async (formatId: string, ext: string, isAudio: boolean, specificInfo?: any) => {
    const info = specificInfo || videoInfo;
    if (!info) return;
    
    const taskId = `${info.id}-${Date.now()}`;
    
    const newRecord: DownloadRecord = {
      id: taskId,
      url: info.url,
      title: info.title,
      file_path: null,
      status: "starting",
      percent: 0,
      format: formatId,
      date_added: Date.now() / 1000,
      hidden: false,
    };
    
    setHistory(prev => [newRecord, ...prev]);
    
    if (!specificInfo) {
      setVideoInfo(null);
      setUrl("");
    }

    try {
      await invoke("start_download", {
        taskId: taskId,
        url: info.url,
        title: info.title,
        formatId: formatId,
        isAudioOnly: isAudio,
        ext: ext,
      });
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleBatchDownload = async (formatId: string, ext: string, isAudio: boolean) => {
    if (!playlistInfo) return;
    const entries = playlistInfo.entries.filter((e: any) => selectedPlaylistItems.has(e.id));
    setPlaylistInfo(null);
    setUrl("");
    
    for (const entry of entries) {
      await handleStartDownload(formatId, ext, isAudio, entry);
    }
  };

  const openFolder = async (path: string | null) => {
    if (!path) return;
    try {
      await invoke("open_folder", { path });
    } catch (e) {
      console.error("Failed to open folder", e);
    }
  };

  const handleRemoveHistory = async (id: string) => {
    await invoke("hide_history_item", { id });
    loadHistory();
  };

  const handleDeleteFile = async (id: string, filePath: string | null) => {
    if (!filePath) return;
    const confirm = window.confirm("Are you sure you want to permanently delete this file from your disk?");
    if (confirm) {
      await invoke("delete_history_file", { id, filePath });
      loadHistory();
    }
  };

  const togglePlaylistItem = (id: string) => {
    setSelectedPlaylistItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-surface-0 text-primary font-sans antialiased overflow-hidden selection:bg-accent-subtle selection:text-accent p-6 gap-6">
      
      {/* Floating Sidebar (Like Image 1) */}
      <div className="w-64 rounded-[32px] overflow-hidden flex flex-col pt-10 pb-6 relative shadow-raised"
           style={{ background: 'linear-gradient(135deg, var(--color-sidebar-bg-start), var(--color-sidebar-bg-end))' }}>
        <div className="px-8 pb-8 text-white relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/20">
              <Download size={20} strokeWidth={2.5} className="text-white" />
            </div>
            <h1 className="text-heading font-bold tracking-tight text-white drop-shadow-sm">Devizee</h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 relative z-10">
          <SidebarItem icon={<Download size={18} />} label="Downloads" active={activeTab === "downloads"} onClick={() => setActiveTab("downloads")} badge={history.filter(h => !STATUS_DISPLAY[h.status].isTerminal).length || undefined} />
          <SidebarItem icon={<Music size={18} />} label="Audio Hub" active={activeTab === "audio"} onClick={() => setActiveTab("audio")} />
          <div className="pt-6 pb-2 px-4 text-caption text-white/60 font-bold uppercase tracking-wider">Preferences</div>
          <SidebarItem icon={<Settings size={18} />} label="Settings" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
        </nav>
        
        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -ml-20 -mb-20 pointer-events-none"></div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden rounded-[32px] bg-white shadow-floating border border-subtle">
        
        {/* Top Header */}
        <header className="h-20 flex items-center px-10 shrink-0 border-b border-subtle bg-white/50 backdrop-blur-md z-20">
          <h2 className="text-display font-bold text-primary">
            {activeTab === "downloads" && "Downloads"}
            {activeTab === "audio" && "Audio Hub"}
            {activeTab === "settings" && "Settings"}
          </h2>
        </header>

        {/* Content Scroll */}
        <div className="flex-1 overflow-y-auto px-10 pt-8 pb-12 z-10 relative bg-white">
          
          {activeTab === "downloads" && (
            <div className="max-w-4xl mx-auto space-y-10">
              
              {/* Vibrant Input Section */}
              <form onSubmit={handleAnalyze} className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-accent">
                  <Search size={22} strokeWidth={2.5} />
                </div>
                <input
                  type="text"
                  placeholder="Paste YouTube, audio, or media link here..."
                  className="w-full bg-surface-0 border-2 border-transparent focus:border-accent/30 focus:bg-white rounded-[24px] h-16 pl-14 pr-40 text-body font-medium transition-all outline-none text-primary placeholder:text-tertiary"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={isFetching || !url}
                  className="absolute right-2 top-2 bottom-2 bg-accent hover:bg-accent-hover text-white px-6 rounded-[18px] font-bold text-body-sm transition-all disabled:opacity-50 flex items-center gap-2 shadow-glow hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isFetching ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} strokeWidth={2.5} />}
                  Analyze
                </button>
              </form>

              {fetchError && (
                <div className="bg-status-danger-subtle border border-status-danger/20 p-5 rounded-[20px] flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                  <div className="w-10 h-10 rounded-full bg-status-danger/10 flex items-center justify-center shrink-0">
                    <AlertCircle className="text-status-danger" size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-bold text-status-danger mb-1">Oops, something went wrong</h4>
                    <p className="text-body-sm text-status-danger/80">{fetchError}</p>
                  </div>
                </div>
              )}

              {/* Playlist Prompt */}
              {isPlaylistPrompt && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-[28px] p-8 shadow-sm animate-in fade-in zoom-in-95 duration-base text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                  
                  <div className="w-16 h-16 bg-white shadow-sm text-indigo-500 rounded-[20px] flex items-center justify-center mx-auto mb-5 relative z-10">
                    <Folder size={32} strokeWidth={2} />
                  </div>
                  <h3 className="text-heading font-bold mb-3 relative z-10 text-indigo-950">Playlist Detected</h3>
                  <p className="text-indigo-900/70 text-body mb-8 max-w-md mx-auto relative z-10 font-medium">This link contains a playlist. Do you want to download just this specific video, or load the entire playlist to select items?</p>
                  
                  <div className="flex items-center justify-center gap-4 relative z-10">
                    <button onClick={() => loadSingleVideo(url.replace(/&list=[^&]+/, ''))} className="px-6 py-3 rounded-[16px] bg-white text-indigo-600 hover:bg-indigo-50 shadow-sm font-bold text-body transition-all hover:shadow hover:-translate-y-0.5">
                      Just this video
                    </button>
                    <button onClick={loadPlaylist} className="px-6 py-3 rounded-[16px] bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/20 font-bold text-body transition-all hover:-translate-y-0.5">
                      Load Playlist
                    </button>
                  </div>
                </div>
              )}

              {/* Playlist Selection UI */}
              {playlistInfo && (
                <div className="bg-white border border-subtle rounded-[28px] p-6 shadow-floating animate-in slide-in-from-bottom-4 fade-in duration-base">
                  <div className="flex items-center justify-between border-b border-subtle pb-6 mb-4">
                    <div>
                      <h3 className="text-heading font-bold text-primary">{playlistInfo.title}</h3>
                      <p className="text-tertiary font-medium mt-1">{playlistInfo.uploader} • {playlistInfo.entries.length} items</p>
                    </div>
                    <div className="flex gap-3">
                       <button onClick={() => handleBatchDownload("bestvideo+bestaudio/best", "mp4", false)} disabled={selectedPlaylistItems.size === 0} className="px-5 py-2.5 bg-accent text-white rounded-[16px] font-bold shadow-glow disabled:opacity-50 hover:-translate-y-0.5 transition-all">
                         Download {selectedPlaylistItems.size} Videos
                       </button>
                       <button onClick={() => handleBatchDownload("bestaudio/best", "mp3", true)} disabled={selectedPlaylistItems.size === 0} className="px-5 py-2.5 bg-surface-0 text-primary hover:bg-surface-2 rounded-[16px] font-bold disabled:opacity-50 transition-all">
                         Download {selectedPlaylistItems.size} Audio
                       </button>
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto space-y-1 pr-4">
                    {playlistInfo.entries.map((entry: any, index: number) => (
                      <label key={entry.id} className="flex items-center gap-4 p-3 hover:bg-surface-0 rounded-[16px] cursor-pointer transition-colors group">
                        <div className="relative flex items-center justify-center w-6 h-6">
                          <input 
                            type="checkbox" 
                            checked={selectedPlaylistItems.has(entry.id)} 
                            onChange={() => togglePlaylistItem(entry.id)}
                            className="w-5 h-5 rounded-[6px] border-2 border-tertiary/40 bg-white text-accent focus:ring-accent accent-accent transition-all cursor-pointer"
                          />
                        </div>
                        <span className="text-tertiary w-6 text-right font-bold opacity-50 group-hover:opacity-100 transition-opacity">{index + 1}</span>
                        <span className="text-body font-semibold line-clamp-1 flex-1 text-primary">{entry.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Video Info Card (Vibrant Gradient style from Image 2) */}
              {videoInfo && (
                <div className="bg-gradient-to-br from-teal-500 to-emerald-400 rounded-[28px] p-6 shadow-glow animate-in slide-in-from-bottom-4 fade-in duration-base text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>
                  
                  <div className="flex gap-6 relative z-10">
                    <div className="w-56 aspect-video rounded-[20px] overflow-hidden bg-black/20 shrink-0 shadow-lg relative border border-white/20">
                      <img src={videoInfo.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white font-bold text-caption px-2 py-1 rounded-lg">
                        {videoInfo.duration_string}
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h3 className="text-heading font-bold line-clamp-2 leading-snug drop-shadow-sm">{videoInfo.title}</h3>
                        <p className="text-white/80 font-semibold mt-2 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <PlayCircle size={14} className="text-white" />
                          </div>
                          {videoInfo.uploader}
                        </p>
                      </div>
                      
                      <div className="mt-6 flex flex-wrap gap-3">
                        {videoInfo.formats.slice(0, 3).map((f) => (
                          <button
                            key={f.format_id}
                            onClick={() => handleStartDownload(f.format_id, f.ext, f.is_audio_only)}
                            className={`px-4 py-2.5 rounded-[16px] font-bold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                              ${f.is_audio_only 
                                ? 'bg-white/20 backdrop-blur-md text-white hover:bg-white/30 border border-white/10' 
                                : 'bg-white text-emerald-600 hover:bg-emerald-50'}
                            `}
                          >
                            {f.label}
                          </button>
                        ))}
                        
                        {videoInfo.formats.length > 3 && (
                           <div className="relative group/dropdown">
                            <button className="px-4 py-2.5 rounded-[16px] font-bold border border-white/30 bg-black/10 backdrop-blur-sm text-white hover:bg-black/20 transition-all">
                              More Qualities
                            </button>
                            <div className="absolute top-full left-0 mt-2 bg-white rounded-[20px] shadow-floating p-2 hidden group-hover/dropdown:block w-56 z-30">
                              {videoInfo.formats.slice(3).map(f => (
                                <button 
                                  key={f.format_id} 
                                  onClick={() => handleStartDownload(f.format_id, f.ext, f.is_audio_only)}
                                  className="block w-full text-left px-4 py-2.5 text-body-sm font-semibold hover:bg-surface-0 rounded-[14px] transition-colors text-primary"
                                >
                                  {f.label}
                                </button>
                              ))}
                            </div>
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* History & Queue */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-heading font-bold text-primary">Recent Activities</h3>
                  <button className="text-body-sm font-bold text-tertiary hover:text-primary transition-colors flex items-center gap-1">
                    All Activities
                  </button>
                </div>
                
                {history.length === 0 ? (
                  <div className="py-16 text-center bg-surface-0 rounded-[28px] border border-subtle border-dashed">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-tertiary">
                      <Download size={24} />
                    </div>
                    <p className="text-tertiary font-bold">No recent activities.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((record) => (
                      <HistoryItem 
                        key={record.id} 
                        record={record} 
                        onOpenFolder={() => openFolder(record.file_path)}
                        onRemove={() => handleRemoveHistory(record.id)}
                        onDeleteFile={() => handleDeleteFile(record.id, record.file_path)}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-3xl mx-auto py-8">
              <div className="bg-white border border-subtle rounded-[32px] p-10 shadow-floating space-y-10">
                <div>
                  <h3 className="text-heading font-bold mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-subtle text-accent flex items-center justify-center">
                      <Folder size={20} />
                    </div>
                    Storage
                  </h3>
                  <div className="space-y-3 pl-13">
                    <label className="text-body font-semibold text-secondary">Default Download Directory</label>
                    <div className="flex gap-3">
                      <input type="text" readOnly value="C:\Users\Default\Downloads\Devizee" className="flex-1 bg-surface-0 border-2 border-transparent focus:border-accent/30 rounded-[16px] px-5 py-3 text-body font-medium text-primary outline-none" />
                      <button className="bg-surface-0 text-primary hover:bg-surface-2 px-6 rounded-[16px] font-bold transition-all shadow-sm">Change</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-[20px] font-bold transition-all outline-none group
        ${active 
          ? 'bg-white/20 text-white shadow-sm backdrop-blur-md' 
          : 'text-white/70 hover:bg-white/10 hover:text-white'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <div className={`${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-fast`}>
          {icon}
        </div>
        {label}
      </div>
      {badge && (
        <span className="bg-white text-accent text-xs px-2.5 py-1 rounded-full font-bold shadow-sm">
          {badge}
        </span>
      )}
    </button>
  );
}

function HistoryItem({ record, onOpenFolder, onRemove, onDeleteFile }: { record: DownloadRecord, onOpenFolder: () => void, onRemove: () => void, onDeleteFile: () => void }) {
  const display = STATUS_DISPLAY[record.status] || STATUS_DISPLAY.error;
  const isTerm = display.isTerminal;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={`bg-white border rounded-[24px] p-5 flex gap-5 transition-all shadow-sm hover:shadow-floating relative group/item
      ${record.status === "missing" ? "opacity-60 grayscale border-subtle" : "border-subtle"}
      ${record.status === "error" ? "border-status-danger/30 bg-status-danger-subtle/30" : ""}
    `}>
      <div className="w-28 aspect-video bg-surface-0 rounded-[16px] flex items-center justify-center text-tertiary overflow-hidden shadow-inner relative">
        <PlayCircle size={24} className="opacity-30" />
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center relative pr-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-body font-bold truncate pr-4 text-primary" title={record.title}>{record.title}</h4>
          
          <div className="shrink-0 flex items-center gap-3">
            <span className={`text-caption font-bold px-3 py-1 rounded-full flex items-center gap-2 ${
              display.colorToken === "accent" ? "bg-accent-subtle text-accent-hover" : 
              display.colorToken === "status-success" ? "bg-status-success-subtle text-status-success" : 
              display.colorToken === "status-danger" ? "bg-status-danger-subtle text-status-danger" :
              display.colorToken === "status-warning" ? "bg-status-warning-subtle text-status-warning" :
              "bg-surface-0 text-secondary"
            }`}>
              {display.colorToken === "accent" && <Loader2 size={12} className="animate-spin" />}
              {display.label} {record.status === "downloading" && `${record.percent}%`}
            </span>
            
            {/* Context Menu Trigger */}
            <div className="relative">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 200)}
                className="w-8 h-8 flex items-center justify-center text-tertiary hover:text-primary hover:bg-surface-0 rounded-full transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-subtle rounded-[20px] shadow-floating p-2 z-30 animate-in zoom-in-95 duration-fast">
                  {record.status === "completed" && (
                    <button onClick={onOpenFolder} className="w-full text-left px-4 py-3 text-body-sm font-bold text-primary hover:bg-surface-0 rounded-[14px] flex items-center gap-3 transition-colors">
                      <Folder size={16} /> Show in Folder
                    </button>
                  )}
                  <button onClick={onRemove} className="w-full text-left px-4 py-3 text-body-sm font-bold text-primary hover:bg-surface-0 rounded-[14px] flex items-center gap-3 transition-colors">
                    <X size={16} /> Remove from List
                  </button>
                  {(record.status === "completed" || record.file_path) && (
                    <div className="px-2 py-1">
                      <div className="h-px bg-subtle w-full"></div>
                    </div>
                  )}
                  {(record.status === "completed" || record.file_path) && (
                    <button onClick={onDeleteFile} className="w-full text-left px-4 py-3 text-body-sm font-bold text-status-danger hover:bg-status-danger-subtle rounded-[14px] flex items-center gap-3 transition-colors">
                      <Trash2 size={16} /> Delete File
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Thick, Friendly Progress Bar Area */}
        <div className="h-2.5 bg-surface-0 rounded-full overflow-hidden mt-2 relative">
          {display.progressMode === "determinate" && (
            <div className="absolute top-0 left-0 bottom-0 bg-accent transition-all duration-fast" style={{ width: `${record.percent}%` }} />
          )}
          {display.progressMode === "indeterminate" && (
            <div className="absolute top-0 left-0 bottom-0 bg-accent w-1/3 animate-pulse" />
          )}
          {record.status === "completed" && (
            <div className="absolute top-0 left-0 bottom-0 bg-status-success w-full" />
          )}
          {record.status === "error" && (
            <div className="absolute top-0 left-0 bottom-0 bg-status-danger w-full opacity-50" />
          )}
        </div>
      </div>
    </div>
  );
}
```

### \`src/App.css\`
```css
@import "tailwindcss";

@theme {
  /* Surfaces - Dribbble Vibe (Light/Mint) */
  --color-surface-0: #f2f7f9;   /* Main background - very soft blue/mint white */
  --color-surface-1: #ffffff;   /* Pure white cards */
  --color-surface-2: #e8f1ef;   /* Hover states */
  --color-surface-3: #ffffff;   /* Elevated panels */

  /* Sidebar Gradient Base */
  --color-sidebar-bg-start: #3ab0b2;
  --color-sidebar-bg-end: #3b82c4;

  /* Borders - almost invisible in this design */
  --color-border-subtle: rgb(0 0 0 / 0.04);
  --color-border-strong: rgb(0 0 0 / 0.08);

  /* Text - very friendly */
  --color-text-primary: #1f2937;
  --color-text-secondary: #64748b;
  --color-text-tertiary: #94a3b8;

  /* Accent Colors */
  --color-accent: #2dd4bf;
  --color-accent-hover: #14b8a6;
  --color-accent-subtle: #ccfbf1;
  --color-accent-contrast: #ffffff;

  /* Status Colors */
  --color-status-success: #10b981;
  --color-status-success-subtle: #d1fae5;
  --color-status-warning: #f59e0b;
  --color-status-warning-subtle: #fef3c7;
  --color-status-danger: #ef4444;
  --color-status-danger-subtle: #fee2e2;
  --color-status-info: #3b82f6;
  --color-status-info-subtle: #dbeafe;

  /* Rounded Corners - EXTREMELY generous (glassmorphism / soft ui) */
  --radius-sm: 12px;
  --radius-md: 20px;
  --radius-lg: 32px;
  --radius-full: 9999px;

  /* Shadows - Big, diffuse, colored */
  --shadow-flat: none;
  --shadow-raised: 0 10px 30px rgb(0 0 0 / 0.04);
  --shadow-floating: 0 20px 40px rgb(0 0 0 / 0.08), 0 0 0 1px rgb(0 0 0 / 0.02);
  --shadow-glow: 0 8px 24px var(--color-accent-subtle);

  /* Typography */
  --font-sans: "Quicksand", "Nunito", "Inter", -apple-system, sans-serif;

  --duration-fast: 150ms;
  --duration-base: 250ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
}

@layer base {
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Quicksand:wght@500;600;700&display=swap');
  
  body {
    font-family: var(--font-sans);
    user-select: none;
    -webkit-user-select: none;
    overflow-x: hidden;
    background: var(--color-surface-0);
    color: var(--color-text-primary);
  }
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border-radius: 9999px;
}

```

### \`.agents/skills/design-system/SKILL.md\` (Deviated)
```markdown
---
name: design-system
description: Use for ANY change that touches colors, spacing, radius, shadows, typography, or motion in the frontend. This is the only source of truth for visual values in this app — no arbitrary Tailwind values (bg-[#09090b], p-[13px], shadow-[0_2px...]) are allowed outside this file. Load references/tokens.css for the exact values.
---

# Design System — Devizee (Linear/Apple-HIG direction)

## Why this exists
The UI has looked "vibe coded" so far because every component invented its
own colors and spacing ad hoc (`emerald-500`, `zinc-900/50`, one-off opacity
values scattered through JSX). Professional apps don't have "a nice
palette" — they have a small, fixed set of **semantic tokens** defined once
and referenced everywhere. This skill is that fixed set. Nothing here is a
suggestion; treat it as load-bearing.

## The rule, stated plainly
**No component may use a raw Tailwind color class (`bg-zinc-900`,
`text-emerald-400`, `border-slate-200`) or an arbitrary value
(`bg-[#09090b]`, `shadow-[...]`) anywhere in JSX.** Every visual value
comes from a token defined in `references/tokens.css`, applied via Tailwind
v4's `@theme` block so tokens become real utility classes
(`bg-surface-1`, `text-primary`, `border-subtle`, `shadow-elevated`, etc).
If a needed value doesn't exist as a token yet, add it to
`references/tokens.css` first — don't invent it inline in a component.

## Token categories (see references/tokens.css for exact values)
1. **Surface colors** — `surface-0` (app bg) through `surface-3`
   (highest elevation, e.g. modals/popovers). Never more than 4 surface
   levels; if a design needs a 5th, that's a sign the layout is too
   layered, not a sign to add a token.
2. **Border colors** — `border-subtle` (default dividers/card edges) and
   `border-strong` (focus rings, active states). Only two — don't add a
   third "medium" border color.
3. **Text colors** — `text-primary`, `text-secondary`, `text-tertiary`.
   Three levels only. `text-tertiary` is for timestamps/metadata, never
   for anything the user needs to read to use the app.
4. **Accent** — one brand accent (`accent`, `accent-hover`,
   `accent-subtle` for badge backgrounds). This is the ONLY saturated
   color allowed for non-status UI (buttons, active tab indicator, focus
   rings, links). It must never be reused to mean "success" — that's a
   different token (see below).
5. **Status colors** — `status-success`, `status-warning`,
   `status-danger`, `status-info`. These are semantically reserved:
   `status-success` only ever means a completed/healthy state,
   `status-danger` only ever means an error/destructive action,
   `status-warning` only for degraded-but-not-failed states. Never borrow
   a status color for decoration, and never use the brand accent color to
   represent a status — that's exactly how you get an ambiguous state
   that silently renders as "mystery yellow." Cross-reference the
   status-model skill for the full state→color mapping — that mapping is
   the only place status colors get chosen.
6. **Radius scale** — `radius-sm` (12px — chips/badges/small buttons),
   `radius-md` (10px — inputs, list rows), `radius-lg` (16px — cards,
   panels), `radius-full` (pills, avatars). Four values, nothing between
   them. Note sm > md here intentionally — small controls read better
   with slightly rounder corners at this size; don't "fix" this without
   checking how it looks first.
7. **Elevation (shadow)** — `shadow-flat` (no shadow — most surfaces),
   `shadow-raised` (dropdowns, context menus), `shadow-floating` (modals,
   toasts). Dark theme shadows are mostly border + subtle glow, not drop
   shadow — real drop shadows barely read on near-black backgrounds. See
   tokens.css for theme-specific implementations of each level.
8. **Typography scale** — `text-caption` through `text-display`, six
   steps, defined with exact px/line-height/weight in tokens.css. Font
   weights are restricted to 400/500/600 only — never 300 (too thin for
   a desktop app at these sizes) or 700+/800/900 (reads as shouting;
   reserve heavy weight for nothing in this app).
9. **Motion** — exactly three durations (`duration-fast` 120ms,
   `duration-base` 200ms, `duration-slow` 320ms) and one easing curve
   (`ease-standard`). No spring/bounce physics anywhere except optionally
   a single one-off celebration micro-animation on "download completed"
   — and even that should be restrained, not playful/gamified (that's
   part of what read as "vibe coded" before).

## Component rules that follow from the tokens
- A card/panel is `surface-1` on `surface-0` background, `radius-lg`,
  `border-subtle`, `shadow-flat` by default — only elevate to
  `shadow-raised` on hover/active if the component is interactive.
- Buttons: primary action = `accent` background + white/near-white text.
  Secondary action = `surface-2` background + `border-subtle` +
  `text-primary`. Never more than one primary-styled button visible in
  the same view — if two feel equally important, that's a hierarchy
  problem to solve in layout, not in color.
- Only one accent color is visible on screen at a time as "the brand
  color" — status colors (progress bars mid-download, error banners) are
  allowed to coexist with it since they mean something different.

## Before/after example
Wrong: `<div className="bg-[#111114] border border-zinc-800/90 rounded-2xl p-4">`
Right: `<div className="bg-surface-1 border-subtle rounded-lg p-4">`
The second version survives a future theme/rebrand change; the first one
requires hunting through every file that copy-pasted that hex value.

```

## 7. Immediate Next Step

My strongest recommendation for the single next task is to implement the **Clipboard Radar (HUD)** feature. We have already installed `@tauri-apps/plugin-clipboard-manager`, but zero logic exists for it. Given the user explicitly named this as their core Unique Selling Proposition (USP) to compete with IDM, building the background polling hook in `App.tsx` and rendering the floating Toast for copied YouTube links will deliver massive immediate value. 

*Secondary priority*: Fixing the hardcoded paths for `yt-dlp` in Rust. Currently, `start_download` spawns `Command::new("yt-dlp.exe")` which works in dev but will instantly crash in a production `msi` bundle. We must switch to `app.path().resource_dir()` or Tauri's official Sidecar API before compiling a release.

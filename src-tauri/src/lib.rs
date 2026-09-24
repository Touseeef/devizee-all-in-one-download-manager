use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

mod db;
mod status;
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
    pub video_formats: Vec<FormatOption>,
    pub audio_formats: Vec<FormatOption>,
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

/// Returns extra yt-dlp args to load cookies from a browser's cookie store.
/// Returns empty when disabled. Browser value matches yt-dlp's
/// --cookies-from-browser spec: "chrome", "edge", "firefox", "brave", etc.
fn cookies_args(cookies_from_browser: Option<String>) -> Vec<String> {
    match cookies_from_browser.as_deref() {
        Some(b) if !b.is_empty() && b != "none" => {
            vec!["--cookies-from-browser".to_string(), b.to_string()]
        }
        _ => Vec::new(),
    }
}

/// Helper function to locate the active yt-dlp executable (Absolute Paths)
fn get_yt_dlp_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // 1. Check self-updated binary in %LOCALAPPDATA% (FR-4.1)
    if let Ok(local_data) = app.path().app_local_data_dir() {
        let updated_bin = local_data.join("bin").join("yt-dlp.exe");
        if updated_bin.exists() {
            return Ok(updated_bin);
        }
    }

    // 2. Check current_exe parent directory (Production install directory / NSIS / MSI)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidates = [
                exe_dir.join("yt-dlp.exe"),
                exe_dir.join("bin").join("yt-dlp.exe"),
                exe_dir.join("yt-dlp-x86_64-pc-windows-msvc.exe"),
                exe_dir
                    .join("bin")
                    .join("yt-dlp-x86_64-pc-windows-msvc.exe"),
            ];
            for path in candidates {
                if path.exists() {
                    return Ok(path);
                }
            }
        }
    }

    // 3. Check Tauri resource_dir()
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join("yt-dlp.exe"),
            resource_dir.join("bin").join("yt-dlp.exe"),
            resource_dir.join("yt-dlp-x86_64-pc-windows-msvc.exe"),
            resource_dir
                .join("bin")
                .join("yt-dlp-x86_64-pc-windows-msvc.exe"),
        ];
        for path in candidates {
            if path.exists() {
                return Ok(path);
            }
        }
    }

    // 4. Check development paths relative to current working dir
    let cwd = std::env::current_dir().unwrap_or_default();
    let dev_candidates = [
        cwd.join("bin").join("yt-dlp-x86_64-pc-windows-msvc.exe"),
        cwd.join("src-tauri")
            .join("bin")
            .join("yt-dlp-x86_64-pc-windows-msvc.exe"),
        cwd.join("bin").join("yt-dlp.exe"),
        cwd.join("src-tauri").join("bin").join("yt-dlp.exe"),
        cwd.join("yt-dlp.exe"),
    ];
    for path in dev_candidates {
        if path.exists() {
            return Ok(path);
        }
    }

    Ok(PathBuf::from("yt-dlp"))
}

/// Helper function to locate the ffmpeg binary (Absolute Paths)
fn get_ffmpeg_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    // 1. Check current_exe parent directory (Production install directory / NSIS / MSI)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidates = [
                exe_dir.join("ffmpeg.exe"),
                exe_dir.join("bin").join("ffmpeg.exe"),
                exe_dir.join("ffmpeg-x86_64-pc-windows-msvc.exe"),
                exe_dir
                    .join("bin")
                    .join("ffmpeg-x86_64-pc-windows-msvc.exe"),
            ];
            for path in candidates {
                if path.exists() {
                    return Some(path);
                }
            }
        }
    }

    // 2. Check Tauri resource_dir()
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join("ffmpeg.exe"),
            resource_dir.join("bin").join("ffmpeg.exe"),
            resource_dir.join("ffmpeg-x86_64-pc-windows-msvc.exe"),
            resource_dir
                .join("bin")
                .join("ffmpeg-x86_64-pc-windows-msvc.exe"),
        ];
        for path in candidates {
            if path.exists() {
                return Some(path);
            }
        }
    }

    // 3. Check development paths relative to current working dir
    let cwd = std::env::current_dir().unwrap_or_default();
    let dev_candidates = [
        cwd.join("bin").join("ffmpeg-x86_64-pc-windows-msvc.exe"),
        cwd.join("src-tauri")
            .join("bin")
            .join("ffmpeg-x86_64-pc-windows-msvc.exe"),
        cwd.join("bin").join("ffmpeg.exe"),
        cwd.join("src-tauri").join("bin").join("ffmpeg.exe"),
        cwd.join("ffmpeg.exe"),
    ];
    dev_candidates.into_iter().find(|path| path.exists())
}

/// Tauri command to inspect any URL and extract metadata & format tiers
#[tauri::command]
async fn fetch_video_info(
    url: String,
    cookies_from_browser: Option<String>,
    app: tauri::AppHandle,
) -> Result<VideoInfo, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;

    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args([
        "--dump-single-json",
        "--no-playlist",
        "--skip-download",
        "--no-warnings",
        "--compat-options",
        "no-youtube-unavailable-videos",
        "--extractor-args",
        "youtube:skip=dash,translated_subs,comments",
    ]);
    for arg in cookies_args(cookies_from_browser) {
        cmd.arg(arg);
    }
    cmd.arg(&url);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to launch download engine: {}", e))?;

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
    let title = json_val["title"]
        .as_str()
        .unwrap_or("Untitled Video")
        .to_string();
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

    let mut video_formats: Vec<FormatOption> = Vec::new();
    let mut audio_formats: Vec<FormatOption> = Vec::new();

    // -- VIDEO FORMATS (Primary + Dropdown) --
    video_formats.push(FormatOption {
        format_id: "bestvideo[height<=1080]+bestaudio/best[height<=1080]".to_string(),
        label: "1080p (Full HD)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("1080p".to_string()),
        filesize_approx: None,
    });

    video_formats.push(FormatOption {
        format_id: "bestvideo[height<=720]+bestaudio/best[height<=720]".to_string(),
        label: "720p (HD)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("720p".to_string()),
        filesize_approx: None,
    });

    video_formats.push(FormatOption {
        format_id: "bestvideo+bestaudio/best".to_string(),
        label: "Best Quality (Auto-Mux)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("Max".to_string()),
        filesize_approx: None,
    });

    video_formats.push(FormatOption {
        format_id: "bestvideo[height<=2160]+bestaudio/best[height<=2160]".to_string(),
        label: "4K (2160p Ultra HD)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("2160p".to_string()),
        filesize_approx: None,
    });

    video_formats.push(FormatOption {
        format_id: "bestvideo[height<=1440]+bestaudio/best[height<=1440]".to_string(),
        label: "2K (1440p QHD)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("1440p".to_string()),
        filesize_approx: None,
    });

    video_formats.push(FormatOption {
        format_id: "bestvideo[height<=480]+bestaudio/best[height<=480]".to_string(),
        label: "480p (Standard)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("480p".to_string()),
        filesize_approx: None,
    });

    video_formats.push(FormatOption {
        format_id: "bestvideo[height<=360]+bestaudio/best[height<=360]".to_string(),
        label: "360p (Data Saver)".to_string(),
        ext: "mp4".to_string(),
        is_audio_only: false,
        resolution: Some("360p".to_string()),
        filesize_approx: None,
    });

    // -- AUDIO FORMATS (Primary + Dropdown) --
    audio_formats.push(FormatOption {
        format_id: "bestaudio/best".to_string(),
        label: "MP3 (320 kbps)".to_string(),
        ext: "mp3".to_string(),
        is_audio_only: true,
        resolution: None,
        filesize_approx: None,
    });

    audio_formats.push(FormatOption {
        format_id: "bestaudio/best".to_string(),
        label: "M4A (256 kbps AAC)".to_string(),
        ext: "m4a".to_string(),
        is_audio_only: true,
        resolution: None,
        filesize_approx: None,
    });

    audio_formats.push(FormatOption {
        format_id: "bestaudio/best".to_string(),
        label: "FLAC (Lossless)".to_string(),
        ext: "flac".to_string(),
        is_audio_only: true,
        resolution: None,
        filesize_approx: None,
    });

    audio_formats.push(FormatOption {
        format_id: "bestaudio/best".to_string(),
        label: "WAV (Uncompressed)".to_string(),
        ext: "wav".to_string(),
        is_audio_only: true,
        resolution: None,
        filesize_approx: None,
    });

    audio_formats.push(FormatOption {
        format_id: "bestaudio/best".to_string(),
        label: "Opus (160 kbps)".to_string(),
        ext: "opus".to_string(),
        is_audio_only: true,
        resolution: None,
        filesize_approx: None,
    });

    let mut formats = video_formats.clone();
    formats.extend(audio_formats.clone());

    Ok(VideoInfo {
        id,
        title,
        url,
        thumbnail,
        duration,
        duration_string,
        uploader,
        video_formats,
        audio_formats,
        formats,
    })
}

fn categorize_error(stderr: &str) -> &'static str {
    let lower = stderr.to_lowercase();
    if lower.contains("network is unreachable")
        || lower.contains("connection refused")
        || lower.contains("connection reset")
        || lower.contains("timed out")
        || lower.contains("unable to download webpage")
        || lower.contains("temporary failure in name resolution")
        || lower.contains("getaddrinfo failed")
        || lower.contains("errno 11001")
        || lower.contains("ssl: certificate_verify_failed")
        || lower.contains("http error 5")
    {
        "network"
    } else if lower.contains("sign in to confirm your age")
        || lower.contains("age-restricted")
        || lower.contains("confirm you're not a bot")
        || lower.contains("bot detection")
    {
        "age_restricted"
    } else if lower.contains("video unavailable")
        || lower.contains("video is unavailable")
        || lower.contains("unavailable")
        || lower.contains("this video has been removed")
        || lower.contains("private video")
        || lower.contains("copyright claim")
        || lower.contains("not available in your country")
        || lower.contains("requested format is not available")
        || lower.contains("http error 404")
        || lower.contains("http error 403")
    {
        "unavailable"
    } else if lower.contains("no space left on device")
        || lower.contains("disk full")
        || lower.contains("not enough space")
        || lower.contains("os error 112")
    {
        "disk_full"
    } else if lower.contains("verification failed") || lower.contains("corrupt") {
        "verification_failed"
    } else {
        "unknown"
    }
}

fn log_download_error(
    app: &tauri::AppHandle,
    task_id: &str,
    url: &str,
    error_code: &str,
    stderr: &str,
) {
    if let Ok(app_dir) = app.path().app_local_data_dir() {
        let logs_dir = app_dir.join("logs");
        let _ = std::fs::create_dir_all(&logs_dir);
        let log_file = logs_dir.join("downloads.log");
        use std::io::Write;
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_file)
        {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let _ = writeln!(
                file,
                "[{}] Task: {} | URL: {} | Code: {}\nStderr:\n{}\n----------------------------------------",
                timestamp, task_id, url, error_code, stderr
            );
        }
    }
}

/// Single Source of Truth for Output Path Resolution
#[allow(clippy::too_many_arguments)]
fn resolve_output_dir(
    app: &tauri::AppHandle,
    base_dir: Option<String>,
    video_dir: Option<String>,
    audio_dir: Option<String>,
    docs_dir: Option<String>,
    comp_dir: Option<String>,
    prog_dir: Option<String>,
    ext: &str,
    is_audio_only: bool,
) -> PathBuf {
    let home_downloads = app
        .path()
        .download_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let default_base = home_downloads.join("Devizee");

    let resolved_base = match base_dir {
        Some(dir) if !dir.trim().is_empty() => {
            let p = PathBuf::from(dir.trim());
            if p.is_absolute() {
                p
            } else {
                let trimmed = dir
                    .trim()
                    .trim_start_matches("Downloads/")
                    .trim_start_matches("Downloads\\");
                home_downloads.join(trimmed)
            }
        }
        _ => default_base,
    };

    let ext_lower = ext.to_lowercase();
    let ext_str = ext_lower.as_str();

    let (default_subfolder, target_override) =
        if is_audio_only || ["mp3", "m4a", "flac", "wav", "opus", "aac"].contains(&ext_str) {
            ("Audio", audio_dir)
        } else if ["mp4", "mkv", "webm", "avi", "mov"].contains(&ext_str) {
            ("Videos", video_dir)
        } else if ["zip", "rar", "7z", "tar", "gz"].contains(&ext_str) {
            ("Compressed", comp_dir)
        } else if ["exe", "msi", "apk", "dmg"].contains(&ext_str) {
            ("Programs", prog_dir)
        } else if ["pdf", "docx", "txt", "epub"].contains(&ext_str) {
            ("Documents", docs_dir)
        } else {
            ("General", None)
        };

    match target_override {
        Some(dir) if !dir.trim().is_empty() => {
            let p = PathBuf::from(dir.trim());
            if p.is_absolute() {
                p
            } else {
                resolved_base.join(p)
            }
        }
        _ => resolved_base.join(default_subfolder),
    }
}

#[tauri::command]
fn fix_legacy_paths(state: tauri::State<AppState>) -> Result<usize, String> {
    // SEC-10: Handle poisoned lock gracefully instead of panicking
    let mut conn = state.db_conn.lock().map_err(|_| "Database lock poisoned".to_string())?;
    let records = db::get_all_downloads(&conn).map_err(|e| e.to_string())?;
    let mut fixed = 0usize;

    // Edge Case: Wrap in transaction so sudden exit or crash leaves database in consistent state
    let tx = conn.transaction().map_err(|e| format!("Failed to begin transaction: {}", e))?;

    for rec in records {
        let old_path = match &rec.file_path {
            Some(p) => p.clone(),
            None => continue,
        };

        let needs_fix = old_path.contains("Downloads\\Devizee\\Downloads\\Devizee\\")
            || old_path.contains("Downloads/Devizee/Downloads/Devizee/");
        if !needs_fix {
            continue;
        }

        let new_path = old_path
            .replace(
                "Downloads\\Devizee\\Downloads\\Devizee\\",
                "Downloads\\Devizee\\",
            )
            .replace("Downloads/Devizee/Downloads/Devizee/", "Downloads/Devizee/");

        let _ = db::update_download_status(
            &tx,
            &rec.id,
            &rec.status,
            rec.percent,
            Some(&new_path),
            None,
            None,
        );
        fixed += 1;
    }

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;
    Ok(fixed)
}

/// Starts a download (spawns yt-dlp in background thread)
#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn start_download(
    task_id: String,
    url: String,
    title: String,
    format_id: String,
    format_label: Option<String>,
    is_audio_only: bool,
    ext: String,
    base_dir: Option<String>,
    video_dir: Option<String>,
    audio_dir: Option<String>,
    docs_dir: Option<String>,
    comp_dir: Option<String>,
    prog_dir: Option<String>,
    temp_dir: Option<String>,
    speed_limit: Option<String>,
    proxy: Option<String>,
    custom_flags: Option<String>,
    scan_antivirus: Option<bool>,
    download_sections: Option<String>,
    cookies_from_browser: Option<String>,
    filename_template: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;
    let ffmpeg_path_opt = get_ffmpeg_path(&app);

    let download_dir = resolve_output_dir(
        &app,
        base_dir.clone(),
        video_dir,
        audio_dir,
        docs_dir,
        comp_dir,
        prog_dir,
        &ext,
        is_audio_only,
    );

    // Edge Case: Validate destination directory write access / drive connectivity
    if !download_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&download_dir) {
            return Err(format!(
                "Cannot access download destination '{:?}': {}. Please check folder permissions or external drive connection.",
                download_dir, e
            ));
        }
    }

    let resolved_temp_dir = match temp_dir {
        Some(ref tdir) if !tdir.trim().is_empty() => {
            let tp = PathBuf::from(tdir.trim());
            let final_tp = if tp.is_absolute() {
                tp
            } else {
                download_dir.join(tp)
            };
            if !final_tp.exists() {
                let _ = std::fs::create_dir_all(&final_tp);
            }
            Some(final_tp)
        }
        _ => None,
    };

    let template = filename_template
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("%(title)s [%(id)s].%(ext)s");

    // SEC-7: Block path traversal in the filename template.
    // A template like "../../Desktop/malicious%(ext)s" would escape the download dir.
    // yt-dlp expands %(title)s from untrusted video metadata, so also pass
    // --restrict-filenames to sanitise the expanded value on the yt-dlp side.
    if template.contains("..") || template.contains('/') || template.contains('\\') {
        return Err(
            "Filename template must not contain path separators or '..'. \
             Use yt-dlp format fields like %(title)s and %(ext)s only."
                .to_string(),
        );
    }

    // Edge Case: Windows 260-char MAX_PATH protection.
    // If the template expands to a path longer than 240 chars, yt-dlp or Windows file creation
    // can fail with OS Error 206/3/123. We cap title expansion in yt-dlp to 100 bytes max.
    let safe_template = if template.contains("%(title)s") {
        template.replace("%(title)s", "%(title).100B")
    } else {
        template.to_string()
    };

    let out_template = download_dir.join(&safe_template);
    let out_template_str = out_template.to_string_lossy().to_string();

    let task_id_clone = task_id.clone();
    let app_clone = app.clone();

    let record = db::DownloadRecord {
        id: task_id.clone(),
        url: url.clone(),
        title: title.clone(),
        file_path: None,
        status: DownloadStatus::Queued,
        percent: 0.0,
        format: format_label.unwrap_or_else(|| format_id.clone()),
        format_id: format_id.clone(),
        date_added: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64,
        hidden: false,
        file_size: None,
        error_code: None,
        error_message: None,
    };

    if let Some(_state) = app.try_state::<AppState>() {
        let conn = db::init_db(&app).expect("Failed to initialize database");
        let _ = db::insert_download(&conn, &record);
    }

    let download_dir_clone = download_dir.clone();
    let url_clone = url.clone();
    let cookies_clone = cookies_from_browser.clone();

    std::thread::spawn(move || {
        let mut cmd = Command::new(&yt_dlp_path);
        let progress_template = "DEVIZEE_PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s";

        cmd.env("PYTHONIOENCODING", "utf-8");
        cmd.args([
            "--encoding",
            "utf-8",
            "--newline",
            "--no-colors",
            "--progress-template",
            progress_template,
            "-o",
            &out_template_str,
            "--force-overwrites",
            "--no-playlist",
            "--no-warnings",
            "--concurrent-fragments",
            "4",
            "--compat-options",
            "no-youtube-unavailable-videos",
            // SEC-7 (defense-in-depth): sanitise expanded template values so that
            // untrusted video titles cannot introduce path separators into filenames.
            "--restrict-filenames",
        ]);

        // Priority 9: Stage temp/.part files into separate temp folder if configured
        if let Some(ref tp) = resolved_temp_dir {
            cmd.args(["-P", &format!("temp:{}", tp.to_string_lossy())]);
        }

        // Cookies from browser (opt-in auth for age-restricted / bot-detected videos)
        for arg in cookies_args(cookies_clone) {
            cmd.arg(arg);
        }

        if is_audio_only {
            let audio_selector = if ext == "m4a" || ext == "aac" {
                "ba[ext=m4a]/ba[acodec^=mp4a]/ba/b"
            } else if ext == "opus" || ext == "webm" {
                "ba[ext=webm]/ba[acodec^=opus]/ba/b"
            } else {
                "ba/b"
            };

            let effective_fmt = if format_id.contains("bestaudio") || format_id.is_empty() {
                audio_selector
            } else {
                &format_id
            };

            cmd.args([
                "-f",
                effective_fmt,
                "-x",
                "--audio-format",
                &ext,
                "--audio-quality",
                "0",
                "--embed-metadata",
                "--embed-thumbnail",
            ]);
        } else {
            cmd.args(["-f", &format_id, "--merge-output-format", &ext]);
        }

        if let Some(ref sec) = download_sections {
            let sec_str = sec.trim();
            if !sec_str.is_empty() {
                cmd.args(["--download-sections", sec_str, "--force-keyframes-at-cuts"]);
            }
        }

        if let Some(ref ffmpeg_path) = ffmpeg_path_opt {
            cmd.arg("--ffmpeg-location");
            cmd.arg(ffmpeg_path);
        }

        if let Some(ref limit) = speed_limit {
            let limit_str = limit.trim();
            if !limit_str.is_empty() && limit_str.to_lowercase() != "unlimited" {
                cmd.args(["--limit-rate", limit_str]);
            }
        }

        if let Some(ref prx) = proxy {
            let prx_str = prx.trim();
            if !prx_str.is_empty() {
                cmd.args(["--proxy", prx_str]);
            }
        }

        // SEC-1: Argument injection guard.
        // custom_flags is split by whitespace and each token is passed as a discrete
        // Command::arg() call (no shell), but yt-dlp flags like --exec / --config-location
        // / --batch-file can still be weaponised. Use a strict allowlist.
        // Value-flag pairs (e.g. "--retries 3") must appear consecutively; the value
        // following a known value-flag is admitted verbatim but is bounded to 256 chars.
        if let Some(ref flags) = custom_flags {
            // Flags that stand alone (no following value)
            const ALLOWED_LONE: &[&str] = &[
                "--geo-bypass",
                "--no-check-certificates",
                "--no-part",
                "--no-playlist",
                "--prefer-free-formats",
                "--force-overwrites",
                "--no-overwrites",
                "--mark-watched",
                "--no-mark-watched",
            ];
            // Flags that take exactly one value token after them
            const ALLOWED_VALUE: &[&str] = &[
                "--limit-rate",
                "--proxy",
                "--retries",
                "--fragment-retries",
                "--concurrent-fragments",
                "--socket-timeout",
                "--source-address",
                "--sleep-interval",
                "--max-sleep-interval",
            ];

            let tokens: Vec<&str> = flags.trim().split_whitespace().collect();
            let mut i = 0;
            while i < tokens.len() {
                let tok = tokens[i];
                if ALLOWED_LONE.contains(&tok) {
                    cmd.arg(tok);
                    i += 1;
                } else if ALLOWED_VALUE.contains(&tok) {
                    if i + 1 < tokens.len() {
                        let val = tokens[i + 1];
                        // Bound value length and reject any shell metacharacters
                        let safe = val.len() <= 256
                            && !val.contains('"')
                            && !val.contains('\'')
                            && !val.contains('`')
                            && !val.contains('&')
                            && !val.contains('|')
                            && !val.contains(';')
                            && !val.contains('\n');
                        if safe {
                            cmd.arg(tok);
                            cmd.arg(val);
                        }
                        i += 2;
                    } else {
                        i += 1; // dangling flag with no value — skip silently
                    }
                } else {
                    // Unrecognised or dangerous flag — silently dropped
                    i += 1;
                }
            }
        }

        cmd.arg(&url_clone);

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);

        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        static GLOBAL_JOB_OBJECT: std::sync::OnceLock<windows_sys::Win32::Foundation::HANDLE> =
            std::sync::OnceLock::new();

        #[cfg(target_os = "windows")]
        fn assign_child_to_job(child: &std::process::Child) {
            use std::os::windows::io::AsRawHandle;
            use windows_sys::Win32::Foundation::HANDLE;
            use windows_sys::Win32::System::JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
                SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            };

            let job_handle = *GLOBAL_JOB_OBJECT.get_or_init(|| unsafe {
                let job = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
                if job != 0 as HANDLE {
                    let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                    info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                    let res = SetInformationJobObject(
                        job,
                        JobObjectExtendedLimitInformation,
                        &info as *const _ as *const std::ffi::c_void,
                        std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                    );
                    if res != 0 {
                        return job;
                    }
                }
                0 as HANDLE
            });

            if job_handle != 0 as windows_sys::Win32::Foundation::HANDLE {
                unsafe {
                    let _ = AssignProcessToJobObject(job_handle, child.as_raw_handle() as HANDLE);
                }
            }
        }

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let err_str = e.to_string();
                log_download_error(
                    &app_clone,
                    &task_id_clone,
                    &url_clone,
                    "spawn_failed",
                    &err_str,
                );
                let _ = app_clone.emit(
                    "download-progress",
                    DownloadProgressPayload {
                        task_id: task_id_clone.clone(),
                        percent: 0.0,
                        speed: "0 B/s".to_string(),
                        eta: "--".to_string(),
                        status: DownloadStatus::Error,
                        error_code: Some("spawn_failed".to_string()),
                        error: Some(err_str.clone()),
                        file_path: None,
                    },
                );
                if let Some(state) = app_clone.try_state::<AppState>() {
                    let conn = state.db_conn.lock().unwrap();
                    let _ = db::update_download_status(
                        &conn,
                        &task_id_clone,
                        &DownloadStatus::Error,
                        0.0,
                        None,
                        Some("spawn_failed"),
                        Some(&err_str),
                    );
                }
                return;
            }
        };

        let pid = child.id();
        if let Some(state) = app_clone.try_state::<AppState>() {
            if let Ok(mut procs) = state.active_processes.lock() {
                procs.insert(task_id_clone.clone(), pid);
            }
        }

        #[cfg(target_os = "windows")]
        assign_child_to_job(&child);

        let _ = app_clone.emit(
            "download-progress",
            DownloadProgressPayload {
                task_id: task_id_clone.clone(),
                percent: 0.0,
                speed: "Booting engine...".to_string(),
                eta: "Waiting for connection".to_string(),
                status: DownloadStatus::Starting,
                error_code: None,
                error: None,
                file_path: None,
            },
        );

        let stderr = child.stderr.take().unwrap();
        let error_logs = Arc::new(Mutex::new(Vec::new()));
        let error_logs_clone = error_logs.clone();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf) {
                if n == 0 {
                    break;
                }
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                buf.clear();
                if !line.is_empty() {
                    let mut logs = error_logs_clone.lock().unwrap();
                    logs.push(line);
                }
            }
        });

        let mut final_file_path = None;
        if let Some(stdout) = child.stdout.take() {
            let mut reader = BufReader::new(stdout);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf) {
                if n == 0 {
                    break;
                }
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                buf.clear();

                if line.contains("DEVIZEE_PROGRESS:") {
                    let parts_str = line.replace("DEVIZEE_PROGRESS:", "");
                    let parts: Vec<&str> = parts_str.split('|').collect();
                    if parts.len() >= 3 {
                        let percent_str = parts[0].trim().replace('%', "");
                        let percent: f32 = percent_str.parse().unwrap_or(0.0);
                        let speed = parts[1].trim().to_string();
                        let eta = parts[2].trim().to_string();

                        let status = if percent >= 100.0 {
                            DownloadStatus::Muxing
                        } else {
                            DownloadStatus::Downloading
                        };

                        let _ = app_clone.emit(
                            "download-progress",
                            DownloadProgressPayload {
                                task_id: task_id_clone.clone(),
                                percent,
                                speed,
                                eta,
                                status: status.clone(),
                                error_code: None,
                                error: None,
                                file_path: None,
                            },
                        );
                        if let Some(state) = app_clone.try_state::<AppState>() {
                            let conn = state.db_conn.lock().unwrap();
                            let _ = db::update_download_status(
                                &conn,
                                &task_id_clone,
                                &status,
                                percent,
                                None,
                                None,
                                None,
                            );
                        }
                    }
                } else if let Some(idx) = line.find("Destination:") {
                    let fp = line[idx + "Destination:".len()..]
                        .trim()
                        .trim_matches('"')
                        .to_string();
                    if !fp.is_empty() {
                        final_file_path = Some(fp);
                    }
                } else if line.contains("Merging formats into") {
                    if let Some(idx) = line.find("Merging formats into") {
                        let fp = line[idx + "Merging formats into".len()..]
                            .trim()
                            .trim_matches('"')
                            .to_string();
                        if !fp.is_empty() {
                            final_file_path = Some(fp);
                        }
                    }
                } else if line.contains("has already been downloaded") {
                    let cleaned = line
                        .replace("[download]", "")
                        .replace("has already been downloaded", "");
                    let fp = cleaned.trim().trim_matches('"').to_string();
                    if !fp.is_empty() {
                        final_file_path = Some(fp);
                    }
                }
            }
        }

        let status = child.wait();

        let was_active = if let Some(state) = app_clone.try_state::<AppState>() {
            if let Ok(mut procs) = state.active_processes.lock() {
                procs.remove(&task_id_clone).is_some()
            } else {
                false
            }
        } else {
            false
        };

        if !was_active {
            return;
        }

        let is_success = match status {
            Ok(s) => s.success(),
            Err(_) => false,
        };

        if is_success {
            if let Some(ref fp) = final_file_path {
                if !std::path::Path::new(fp).exists() {
                    if let Ok(entries) = std::fs::read_dir(&download_dir_clone) {
                        for entry in entries.flatten() {
                            let p = entry.path();
                            if p.is_file() {
                                if let Some(ext_os) = p.extension() {
                                    let ext_str = ext_os.to_string_lossy();
                                    if ext_str != "part" && ext_str != "ytdl" {
                                        if let Ok(meta) = p.metadata() {
                                            if let Ok(mtime) = meta.modified() {
                                                if let Ok(elapsed) = mtime.elapsed() {
                                                    if elapsed.as_secs() < 30 {
                                                        final_file_path =
                                                            Some(p.to_string_lossy().to_string());
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            #[cfg(target_os = "windows")]
            if scan_antivirus.unwrap_or(false) {
                if let Some(ref fp) = final_file_path {
                    let mpcmdrun = r"C:\Program Files\Windows Defender\MpCmdRun.exe";
                    if std::path::Path::new(mpcmdrun).exists() {
                        let mut av_cmd = Command::new(mpcmdrun);
                        av_cmd.args(["-Scan", "-ScanType", "3", "-File", fp]);
                        av_cmd.creation_flags(0x08000000);
                        let _ = av_cmd.status();
                    }
                }
            }

            let _ = app_clone.emit(
                "download-progress",
                DownloadProgressPayload {
                    task_id: task_id_clone.clone(),
                    percent: 100.0,
                    speed: "Done".to_string(),
                    eta: "".to_string(),
                    status: DownloadStatus::Completed,
                    error_code: None,
                    error: None,
                    file_path: final_file_path.clone(),
                },
            );
            if let Some(state) = app_clone.try_state::<AppState>() {
                let conn = state.db_conn.lock().unwrap();
                let _ = db::update_download_status(
                    &conn,
                    &task_id_clone,
                    &DownloadStatus::Completed,
                    100.0,
                    final_file_path.as_deref(),
                    None,
                    None,
                );
            }
        } else {
            let logs = error_logs.lock().unwrap().join("\n");
            let error_code = categorize_error(&logs);
            log_download_error(&app_clone, &task_id_clone, &url_clone, error_code, &logs);

            let _ = app_clone.emit(
                "download-progress",
                DownloadProgressPayload {
                    task_id: task_id_clone.clone(),
                    percent: 0.0,
                    speed: "".to_string(),
                    eta: "".to_string(),
                    status: DownloadStatus::Error,
                    error_code: Some(error_code.to_string()),
                    error: Some(logs.clone()),
                    file_path: None,
                },
            );
            if let Some(state) = app_clone.try_state::<AppState>() {
                let conn = state.db_conn.lock().unwrap();
                let _ = db::update_download_status(
                    &conn,
                    &task_id_clone,
                    &DownloadStatus::Error,
                    0.0,
                    None,
                    Some(error_code),
                    Some(&logs),
                );
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn resolve_folder_path(
    path: Option<String>,
    base_dir: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let home_downloads: PathBuf = {
        #[cfg(target_os = "windows")]
        {
            std::env::var("USERPROFILE")
                .map(|p| PathBuf::from(p).join("Downloads"))
                .unwrap_or_else(|_| {
                    app.path()
                        .download_dir()
                        .unwrap_or_else(|_| PathBuf::from("."))
                })
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::env::var("HOME")
                .map(|p| PathBuf::from(p).join("Downloads"))
                .unwrap_or_else(|_| {
                    app.path()
                        .download_dir()
                        .unwrap_or_else(|_| PathBuf::from("."))
                })
        }
    };
    let default_base = home_downloads.join("Devizee");

    let resolved_base: PathBuf = match base_dir {
        Some(dir) if !dir.trim().is_empty() => {
            let p = PathBuf::from(dir.trim());
            if p.is_absolute() {
                p
            } else {
                let trimmed = dir
                    .trim()
                    .trim_start_matches("Downloads/")
                    .trim_start_matches("Downloads\\");
                home_downloads.join(trimmed)
            }
        }
        _ => default_base.clone(),
    };

    let target: PathBuf = match path {
        Some(p) if !p.trim().is_empty() => {
            let pb = PathBuf::from(p.trim());
            if pb.exists() {
                pb
            } else {
                let alt = resolved_base.join(p.trim());
                if alt.exists() {
                    alt
                } else {
                    resolved_base.clone()
                }
            }
        }
        _ => resolved_base.clone(),
    };

    if !target.exists() {
        let _ = std::fs::create_dir_all(&target);
    }

    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
async fn open_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    // SEC-2: Never open files through cmd.exe / xdg-open with user-controlled paths.
    // The opener plugin uses ShellExecuteW / xdg-open internally but does NOT invoke
    // a shell interpreter, so shell metacharacters are inert. Additionally we block
    // executable extensions that should never be "opened" from the download history UI.
    let p = std::path::Path::new(&path);

    // Must exist and be a regular file
    if !p.exists() {
        return Err("File not found".to_string());
    }
    if !p.is_file() {
        return Err("Path is not a regular file".to_string());
    }

    // Block executable/script extensions — these have no legitimate reason to be
    // "opened" from the download-history UI; the user should locate them in Explorer.
    const DANGEROUS_EXT: &[&str] = &[
        "exe", "msi", "bat", "cmd", "ps1", "vbs", "js", "wsf", "com", "scr",
        "pif", "hta", "reg", "lnk",
    ];
    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
        if DANGEROUS_EXT.contains(&ext.to_lowercase().as_str()) {
            return Err(
                "Opening executable files is not allowed from Devizee. Use File Explorer.".to_string()
            );
        }
    }

    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_autostart(enable: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe_path.to_string_lossy().to_string();

        if enable {
            let output = Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "Devizee",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &format!("\"{}\"", exe_str),
                    "/f",
                ])
                .creation_flags(0x08000000)
                .output()
                .map_err(|e| e.to_string())?;
            if !output.status.success() {
                return Err(String::from_utf8_lossy(&output.stderr).to_string());
            }
        } else {
            let _ = Command::new("reg")
                .args([
                    "delete",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "Devizee",
                    "/f",
                ])
                .creation_flags(0x08000000)
                .output();
        }
    }
    Ok(())
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PlaylistEntry {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: String,
    pub duration_string: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PlaylistInfo {
    pub id: String,
    pub title: String,
    pub uploader: String,
    pub entries: Vec<PlaylistEntry>,
}

#[tauri::command]
async fn get_audio_stream_url(
    url: String,
    cookies_from_browser: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;
    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args([
        "-f",
        "bestaudio/best",
        "-g",
        "--no-warnings",
        "--extractor-args",
        "youtube:skip=dash,translated_subs,comments",
    ]);
    for arg in cookies_args(cookies_from_browser) {
        cmd.arg(arg);
    }
    cmd.arg(&url);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().map_err(|e| e.to_string())?;
    if output.status.success() {
        let stream_url = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !stream_url.is_empty() {
            return Ok(stream_url);
        }
    }
    Err("Could not retrieve audio stream URL".to_string())
}

#[tauri::command]
async fn get_video_stream_url(
    url: String,
    cookies_from_browser: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;
    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args([
        "-f",
        "best[ext=mp4]/best",
        "-g",
        "--no-warnings",
        "--extractor-args",
        "youtube:skip=dash,translated_subs,comments",
    ]);
    for arg in cookies_args(cookies_from_browser) {
        cmd.arg(arg);
    }
    cmd.arg(&url);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().map_err(|e| e.to_string())?;
    if output.status.success() {
        let stream_url = String::from_utf8_lossy(&output.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        if !stream_url.is_empty() {
            return Ok(stream_url);
        }
    }
    Err("Could not retrieve video stream URL".to_string())
}

#[tauri::command]
async fn fetch_playlist_info(
    url: String,
    cookies_from_browser: Option<String>,
    app: tauri::AppHandle,
) -> Result<PlaylistInfo, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;

    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args([
        "--dump-single-json",
        "--flat-playlist",
        "--yes-playlist",
        "--playlist-end",
        "100",
        "--no-warnings",
        "--compat-options",
        "no-youtube-unavailable-videos",
        "--extractor-args",
        "youtube:skip=dash,translated_subs,comments",
    ]);
    for arg in cookies_args(cookies_from_browser) {
        cmd.arg(arg);
    }
    cmd.arg(&url);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    let json_val: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let id = json_val["id"].as_str().unwrap_or("unknown").to_string();
    let title = json_val["title"]
        .as_str()
        .unwrap_or("Untitled Playlist")
        .to_string();
    let uploader = json_val["uploader"]
        .as_str()
        .or_else(|| json_val["channel"].as_str())
        .unwrap_or("Unknown")
        .to_string();

    let mut entries = Vec::new();
    if let Some(entries_arr) = json_val["entries"].as_array() {
        for entry in entries_arr {
            let entry_id = entry["id"].as_str().unwrap_or("").to_string();
            let entry_title = entry["title"]
                .as_str()
                .unwrap_or("Unknown Title")
                .to_string();
            let entry_url = entry["url"].as_str().unwrap_or("").to_string();

            let final_url = if entry_url.is_empty() && !entry_id.is_empty() {
                format!("https://www.youtube.com/watch?v={}", entry_id)
            } else {
                entry_url
            };

            let thumbnail = entry["thumbnail"]
                .as_str()
                .or_else(|| {
                    entry["thumbnails"]
                        .as_array()
                        .and_then(|arr| arr.last())
                        .and_then(|t| t["url"].as_str())
                })
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    if !entry_id.is_empty() {
                        format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", entry_id)
                    } else {
                        "".to_string()
                    }
                });

            let duration_secs = entry["duration"].as_u64();
            let duration_string = match duration_secs {
                Some(secs) => {
                    let m = secs / 60;
                    let s = secs % 60;
                    format!("{}:{:02}", m, s)
                }
                None => "--:--".to_string(),
            };

            if !entry_id.is_empty() {
                entries.push(PlaylistEntry {
                    id: entry_id,
                    title: entry_title,
                    url: final_url,
                    thumbnail,
                    duration_string,
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

#[tauri::command]
async fn search_youtube(
    query: String,
    cookies_from_browser: Option<String>,
    app: tauri::AppHandle,
) -> Result<Vec<PlaylistEntry>, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;
    let clean_query = query.trim();
    if clean_query.is_empty() {
        return Ok(Vec::new());
    }
    let search_term = format!("ytsearch5:{}", clean_query);

    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args([
        "--dump-single-json",
        "--flat-playlist",
        "--skip-download",
        "--no-warnings",
        "--compat-options",
        "no-youtube-unavailable-videos",
    ]);
    for arg in cookies_args(cookies_from_browser) {
        cmd.arg(arg);
    }
    cmd.arg(&search_term);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("YouTube search failed".to_string());
    }

    let json_val: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse search results: {}", e))?;

    let mut entries = Vec::new();
    if let Some(arr) = json_val["entries"].as_array() {
        for entry in arr {
            let entry_id = entry["id"].as_str().unwrap_or("").to_string();
            let entry_title = entry["title"]
                .as_str()
                .unwrap_or("Untitled Video")
                .to_string();
            let final_url = entry["url"]
                .as_str()
                .map(|u| {
                    if u.starts_with("http") {
                        u.to_string()
                    } else {
                        format!("https://www.youtube.com/watch?v={}", u)
                    }
                })
                .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", entry_id));

            let thumbnail = entry["thumbnail"]
                .as_str()
                .map(|t| t.to_string())
                .unwrap_or_else(|| {
                    if !entry_id.is_empty() {
                        format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", entry_id)
                    } else {
                        "".to_string()
                    }
                });

            let duration_secs = entry["duration"].as_u64();
            let duration_string = match duration_secs {
                Some(secs) => {
                    let m = secs / 60;
                    let s = secs % 60;
                    format!("{}:{:02}", m, s)
                }
                None => "--:--".to_string(),
            };

            if !entry_id.is_empty() {
                entries.push(PlaylistEntry {
                    id: entry_id,
                    title: entry_title,
                    url: final_url,
                    thumbnail,
                    duration_string,
                });
            }
        }
    }

    Ok(entries)
}

struct AppState {
    db_conn: std::sync::Mutex<rusqlite::Connection>,
    active_processes: std::sync::Arc<std::sync::Mutex<std::collections::HashMap<String, u32>>>,
}

#[tauri::command]
async fn pause_download(
    task_id: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let pid_opt = {
        let mut procs = state.active_processes.lock().map_err(|_| "Process map lock poisoned")?;
        procs.remove(&task_id)
    };

    if let Some(pid) = pid_opt {
        #[cfg(target_os = "windows")]
        {
            let mut kill_cmd = Command::new("taskkill");
            kill_cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
            kill_cmd.creation_flags(0x08000000);
            let _ = kill_cmd.status();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let mut kill_cmd = Command::new("kill");
            kill_cmd.args(["-9", &pid.to_string()]);
            let _ = kill_cmd.status();
        }
    }

    {
        let conn = state.db_conn.lock().map_err(|_| "Database lock poisoned")?;
        let _ = db::update_status_only(&conn, &task_id, &DownloadStatus::Interrupted);
    }

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            task_id,
            percent: 0.0,
            speed: "Paused".to_string(),
            eta: "--".to_string(),
            status: DownloadStatus::Interrupted,
            error_code: None,
            error: None,
            file_path: None,
        },
    );

    Ok(())
}

#[tauri::command]
async fn cancel_download(
    task_id: String,
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let pid_opt = {
        let mut procs = state.active_processes.lock().map_err(|_| "Process map lock poisoned")?;
        procs.remove(&task_id)
    };

    if let Some(pid) = pid_opt {
        #[cfg(target_os = "windows")]
        {
            let mut kill_cmd = Command::new("taskkill");
            kill_cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
            kill_cmd.creation_flags(0x08000000);
            let _ = kill_cmd.status();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let mut kill_cmd = Command::new("kill");
            kill_cmd.args(["-9", &pid.to_string()]);
            let _ = kill_cmd.status();
        }
    }

    {
        let conn = state.db_conn.lock().map_err(|_| "Database lock poisoned")?;
        let _ = db::update_status_only(&conn, &task_id, &DownloadStatus::Cancelled);
    }

    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            task_id,
            percent: 0.0,
            speed: "Cancelled".to_string(),
            eta: "--".to_string(),
            status: DownloadStatus::Cancelled,
            error_code: None,
            error: None,
            file_path: None,
        },
    );

    Ok(())
}

#[tauri::command]
async fn fetch_audio_bytes(
    url: String,
    cookies_from_browser: Option<String>,
    app: tauri::AppHandle,
) -> Result<Vec<u8>, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;
    let ffmpeg_path = get_ffmpeg_path(&app);

    let mut cmd = Command::new(&yt_dlp_path);
    cmd.env("PYTHONIOENCODING", "utf-8");
    cmd.args([
        "-f",
        "bestaudio[ext=webm]/bestaudio/best",
        "-o",
        "-",
        "--no-playlist",
        "--no-warnings",
        "--no-colors",
        "--quiet",
        "--no-part",
        "--concurrent-fragments",
        "4",
    ]);
    for arg in cookies_args(cookies_from_browser) {
        cmd.arg(arg);
    }
    if let Some(ref ff) = ffmpeg_path {
        cmd.arg("--ffmpeg-location");
        cmd.arg(ff);
    }
    cmd.arg(&url);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let clean: Vec<&str> = stderr
            .lines()
            .filter(|l| !l.trim().is_empty())
            .take(5)
            .collect();
        return Err(format!("yt-dlp failed: {}", clean.join(" | ")));
    }

    if output.stdout.len() < 4096 {
        return Err(format!(
            "Audio fetch returned only {} bytes — likely an error page, not real media",
            output.stdout.len()
        ));
    }

    Ok(output.stdout)
}

#[tauri::command]
async fn read_local_file(path: String, app: tauri::AppHandle) -> Result<Vec<u8>, String> {
    // SEC-3: Restrict file reads to the download directory tree.
    // Any path that canonicalizes outside Downloads/Devizee (or the user-configured
    // equivalent) is rejected — this prevents a compromised frontend from reading
    // SSH keys, browser cookies, or arbitrary system files.

    let p = std::path::Path::new(&path);

    // Require the file to actually exist before canonicalizing
    if !p.exists() || !p.is_file() {
        return Err("File not found".to_string());
    }

    let canonical = p.canonicalize().map_err(|e| {
        format!("Path resolution failed: {}", e)
    })?;

    // Determine the allowed root: system Downloads/Devizee
    let allowed_root = app
        .path()
        .download_dir()
        .map(|d| d.join("Devizee"))
        .unwrap_or_else(|_| std::path::PathBuf::from("."));

    // Try to canonicalize the allowed root; if it doesn't exist yet, use it as-is
    let allowed_canonical = allowed_root.canonicalize().unwrap_or(allowed_root);

    if !canonical.starts_with(&allowed_canonical) {
        return Err(
            "Access denied: file is outside the Devizee download directory".to_string()
        );
    }

    std::fs::read(&canonical).map_err(|e| format!("read_local_file failed: {}", e))
}

#[tauri::command]
fn get_history(state: tauri::State<AppState>) -> Result<Vec<db::DownloadRecord>, String> {
    // SEC-10: Handle poisoned lock gracefully
    let conn = state.db_conn.lock().map_err(|_| "Database lock poisoned".to_string())?;

    let mut records = db::get_all_downloads(&conn).map_err(|e| e.to_string())?;
    for record in &mut records {
        if record.status == DownloadStatus::Completed {
            if let Some(ref path) = record.file_path {
                let p = std::path::Path::new(path);
                if !p.exists() {
                    record.status = DownloadStatus::Missing;
                    let _ = db::update_download_status(
                        &conn,
                        &record.id,
                        &DownloadStatus::Missing,
                        record.percent,
                        Some(path),
                        None,
                        None,
                    );
                } else if let Ok(meta) = std::fs::metadata(p) {
                    record.file_size = Some(meta.len());
                }
            }
        }
    }
    Ok(records)
}

#[tauri::command]
fn hide_history_item(id: String, state: tauri::State<AppState>) -> Result<(), String> {
    // SEC-10: Handle poisoned lock gracefully
    let conn = state.db_conn.lock().map_err(|_| "Database lock poisoned".to_string())?;
    db::hide_download(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_history_file(
    id: String,
    file_path: String,
    state: tauri::State<AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // SEC-6: Restrict file deletion to the download directory tree.
    // file_path comes from the frontend and must be validated before deletion.
    let p = std::path::Path::new(&file_path);
    if p.exists() {
        // Canonicalize and bounds-check before deletion
        let canonical = p
            .canonicalize()
            .map_err(|e| format!("Path resolution failed: {}", e))?;

        let allowed_root = app
            .path()
            .download_dir()
            .map(|d| d.join("Devizee"))
            .unwrap_or_else(|_| std::path::PathBuf::from("."));
        let allowed_canonical = allowed_root.canonicalize().unwrap_or(allowed_root);

        if !canonical.starts_with(&allowed_canonical) {
            return Err(
                "Access denied: file is outside the Devizee download directory".to_string()
            );
        }

        let _ = std::fs::remove_file(&canonical);
    }
    let conn = state.db_conn.lock().map_err(|_| "Database lock poisoned".to_string())?;
    db::hide_download(&conn, &id).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
            let mut iter = argv.iter();
            while let Some(arg) = iter.next() {
                if arg == "--url" {
                    if let Some(target) = iter.next() {
                        let _ = app.emit("open-url", target.to_string());
                    }
                } else if arg.starts_with("streamgrab://download?url=") {
                    // SEC-8: Validate the extracted URL before dispatching.
                    // Only http/https URLs are valid download targets.
                    let raw = arg.trim_start_matches("streamgrab://download?url=");
                    // Basic percent-decode of the first layer only (URL contains encoded URL)
                    let decoded = raw.replace("%3A", ":").replace("%2F", "/");
                    if decoded.starts_with("http://") || decoded.starts_with("https://") {
                        let _ = app.emit("open-url", decoded);
                    }
                    // Non-http URLs (file://, javascript:, data:, etc.) are silently dropped
                } else if arg.starts_with("http://") || arg.starts_with("https://") {
                    // Already a validated http/https URL from the single-instance argv
                    let _ = app.emit("open-url", arg.to_string());
                }
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let ctrl_shift_d =
                        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyD);
                    if shortcut == &ctrl_shift_d {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                        let _ = app.emit("global-hotkey-paste", ());
                    }
                })
                .build(),
        )
        .setup(|app| {
            let conn = db::init_db(app.handle()).expect("Failed to initialize database");
            app.manage(AppState {
                db_conn: std::sync::Mutex::new(conn),
                active_processes: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
            });

            // System tray icon + menu
            let open_item = MenuItem::with_id(app, "open", "Open Devizee", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            let icon = app
                .default_window_icon()
                .ok_or("No default window icon configured")?
                .clone();

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("Devizee Lite - Universal Video Downloader")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fetch_video_info,
            fetch_playlist_info,
            search_youtube,
            get_audio_stream_url,
            get_video_stream_url,
            start_download,
            pause_download,
            cancel_download,
            resolve_folder_path,
            open_file,
            get_history,
            hide_history_item,
            delete_history_file,
            set_autostart,
            fetch_audio_bytes,
            fix_legacy_paths,
            read_local_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

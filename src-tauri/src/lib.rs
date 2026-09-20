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
                exe_dir.join("bin").join("yt-dlp-x86_64-pc-windows-msvc.exe"),
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
            resource_dir.join("bin").join("yt-dlp-x86_64-pc-windows-msvc.exe"),
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
        cwd.join("src-tauri").join("bin").join("yt-dlp-x86_64-pc-windows-msvc.exe"),
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
                exe_dir.join("bin").join("ffmpeg-x86_64-pc-windows-msvc.exe"),
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
            resource_dir.join("bin").join("ffmpeg-x86_64-pc-windows-msvc.exe"),
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
        cwd.join("src-tauri").join("bin").join("ffmpeg-x86_64-pc-windows-msvc.exe"),
        cwd.join("bin").join("ffmpeg.exe"),
        cwd.join("src-tauri").join("bin").join("ffmpeg.exe"),
        cwd.join("ffmpeg.exe"),
    ];
    for path in dev_candidates {
        if path.exists() {
            return Some(path);
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
        "--extractor-args",
        "youtube:skip=dash,translated_subs,comments",
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

#[cfg(target_os = "windows")]
static GLOBAL_JOB_OBJECT: std::sync::OnceLock<windows_sys::Win32::Foundation::HANDLE> = std::sync::OnceLock::new();

#[cfg(target_os = "windows")]
fn assign_child_to_job(child: &std::process::Child) {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::System::JobObjects::{
        CreateJobObjectW, SetInformationJobObject, AssignProcessToJobObject,
        JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows_sys::Win32::Foundation::HANDLE;

    let job_handle = *GLOBAL_JOB_OBJECT.get_or_init(|| {
        unsafe {
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
        }
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

        #[cfg(target_os = "windows")]
        assign_child_to_job(&child);

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
async fn get_audio_stream_url(url: String, app: tauri::AppHandle) -> Result<String, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;
    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args([
        "-f", "bestaudio/best",
        "-g",
        "--no-warnings",
        "--extractor-args",
        "youtube:skip=dash,translated_subs,comments",
        &url,
    ]);
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
async fn fetch_playlist_info(url: String, app: tauri::AppHandle) -> Result<PlaylistInfo, String> {
    let yt_dlp_path = get_yt_dlp_path(&app)?;

    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args([
        "--dump-single-json",
        "--flat-playlist",
        "--no-warnings",
        "--compat-options",
        "no-youtube-unavailable-videos",
        "--extractor-args",
        "youtube:skip=dash,translated_subs,comments",
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

            let thumbnail = entry["thumbnail"]
                .as_str()
                .or_else(|| {
                    entry["thumbnails"].as_array().and_then(|arr| arr.last()).and_then(|t| t["url"].as_str())
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
            get_audio_stream_url,
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

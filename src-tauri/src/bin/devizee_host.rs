use serde_json::Value;
use std::io::{Read, Write};
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

fn main() {
    let mut stdin = std::io::stdin();
    let mut stdout = std::io::stdout();

    // Read 4-byte little-endian message length prefix
    let mut len_buf = [0u8; 4];
    if stdin.read_exact(&mut len_buf).is_err() {
        return;
    }
    let msg_len = u32::from_le_bytes(len_buf) as usize;
    if msg_len == 0 || msg_len > 10 * 1024 * 1024 {
        return;
    }

    // Read exact payload
    let mut payload = vec![0u8; msg_len];
    if stdin.read_exact(&mut payload).is_err() {
        return;
    }

    // Parse JSON payload
    if let Ok(json) = serde_json::from_slice::<Value>(&payload) {
        if let Some(url) = json.get("url").and_then(|u| u.as_str()) {
            dispatch_url(url);
        }
    }

    // Send response {"status":"ok"} back to Chrome
    let response = b"{\"status\":\"ok\"}";
    let resp_len = (response.len() as u32).to_le_bytes();
    let _ = stdout.write_all(&resp_len);
    let _ = stdout.write_all(response);
    let _ = stdout.flush();
}

fn dispatch_url(url: &str) {
    let mut candidates = Vec::new();

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("devizee-all-in-one-download-manager.exe"));
            candidates.push(exe_dir.join("Devizee.exe"));
            candidates.push(
                exe_dir
                    .join("..")
                    .join("devizee-all-in-one-download-manager.exe"),
            );
            candidates.push(
                exe_dir
                    .join("..")
                    .join("src-tauri")
                    .join("target")
                    .join("debug")
                    .join("devizee-all-in-one-download-manager.exe"),
            );
            candidates.push(
                exe_dir
                    .join("..")
                    .join("src-tauri")
                    .join("target")
                    .join("release")
                    .join("devizee-all-in-one-download-manager.exe"),
            );
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(
            cwd.join("src-tauri")
                .join("target")
                .join("debug")
                .join("devizee-all-in-one-download-manager.exe"),
        );
        candidates.push(
            cwd.join("src-tauri")
                .join("target")
                .join("release")
                .join("devizee-all-in-one-download-manager.exe"),
        );
        candidates.push(
            cwd.join("target")
                .join("debug")
                .join("devizee-all-in-one-download-manager.exe"),
        );
        candidates.push(
            cwd.join("target")
                .join("release")
                .join("devizee-all-in-one-download-manager.exe"),
        );
    }

    let mut launched = false;
    for cand in candidates {
        if cand.exists() {
            let mut cmd = Command::new(&cand);
            cmd.args(["--url", url]);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            if cmd.spawn().is_ok() {
                launched = true;
                break;
            }
        }
    }

    // Fallback to protocol scheme if direct binary execution fails
    if !launched {
        let deep_link = format!("streamgrab://download?url={}", url);
        #[cfg(target_os = "windows")]
        {
            let mut cmd = Command::new("cmd");
            cmd.args(["/C", "start", "", &deep_link]);
            cmd.creation_flags(0x08000000);
            let _ = cmd.spawn();
        }
    }
}

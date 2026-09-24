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
    // SEC-4: Validate URL scheme before doing anything with it.
    // The URL comes from the browser extension; only http/https URLs are valid targets.
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return;
    }

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

    // Fallback to protocol scheme if direct binary execution fails.
    // SEC-4: Use ShellExecuteW instead of cmd /C start.
    // ShellExecuteW dispatches the streamgrab:// URL to the registered protocol
    // handler without invoking a shell — metacharacters in the URL are inert.
    if !launched {
        #[cfg(target_os = "windows")]
        {
            use std::ffi::OsStr;
            use std::iter::once;
            use std::os::windows::ffi::OsStrExt;

            // URL-encode the http URL so it is safe as a query parameter value
            let encoded_url = url
                .replace('&', "%26")
                .replace('#', "%23");
            let deep_link = format!("streamgrab://download?url={}", encoded_url);

            // Convert to wide string (null-terminated UTF-16) for ShellExecuteW
            let wide: Vec<u16> = OsStr::new(&deep_link)
                .encode_wide()
                .chain(once(0u16))
                .collect();
            let verb: Vec<u16> = OsStr::new("open")
                .encode_wide()
                .chain(once(0u16))
                .collect();

            unsafe {
                use windows_sys::Win32::UI::Shell::ShellExecuteW;
                ShellExecuteW(
                    0,                    // hwnd: no parent window
                    verb.as_ptr(),        // lpOperation: "open"
                    wide.as_ptr(),        // lpFile: the streamgrab:// URL
                    std::ptr::null(),     // lpParameters
                    std::ptr::null(),     // lpDirectory
                    1,                    // nShowCmd: SW_SHOWNORMAL
                );
            }
        }
    }
}

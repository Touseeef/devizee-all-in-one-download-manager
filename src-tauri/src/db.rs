use crate::status::DownloadStatus;
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadRecord {
    pub id: String,
    pub url: String,
    pub title: String,
    pub file_path: Option<String>,
    pub status: DownloadStatus,
    pub percent: f32,
    pub format: String,
    pub format_id: String,
    pub date_added: i64,
    pub hidden: bool,
    #[serde(default)]
    pub file_size: Option<u64>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

pub fn init_db(app: &AppHandle) -> Result<Connection> {
    let app_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
    }
    let db_path = app_dir.join("downloads.db");
    let conn = Connection::open(db_path)?;

    // ─── F-23: Concurrency & crash-safety pragmas ────────────────────────────
    // journal_mode = WAL → readers don't block writers; the DB doesn't lock
    //   during long progress-update bursts. Persists across connections.
    // synchronous = NORMAL → safe with WAL; crashes never corrupt; faster than
    //   FULL by skipping per-commit fsync on some operations.
    // busy_timeout = 5000ms → if another writer holds a lock (rare with WAL),
    //   wait up to 5s instead of erroring immediately.
    // foreign_keys = ON → future-proof for when we add FK constraints.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.busy_timeout(std::time::Duration::from_millis(5000))?;

    // Complete base table schema
    conn.execute(
        "CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            file_path TEXT,
            status TEXT NOT NULL,
            percent REAL NOT NULL,
            format TEXT NOT NULL,
            date_added INTEGER NOT NULL,
            hidden BOOLEAN NOT NULL DEFAULT 0,
            error_code TEXT,
            error_message TEXT,
            format_id TEXT DEFAULT ''
        )",
        [],
    )?;

    // Safe migration fallbacks for existing legacy databases
    let _ = conn.execute("ALTER TABLE downloads ADD COLUMN error_code TEXT", []);
    let _ = conn.execute("ALTER TABLE downloads ADD COLUMN error_message TEXT", []);
    let _ = conn.execute(
        "ALTER TABLE downloads ADD COLUMN format_id TEXT DEFAULT ''",
        [],
    );

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Mark active downloads as interrupted if app crashed/closed
    conn.execute(
        "UPDATE downloads SET status = 'interrupted' WHERE status IN ('queued', 'starting', 'fetching_metadata', 'downloading', 'muxing', 'verifying')",
        [],
    )?;

    Ok(conn)
}

pub fn insert_download(conn: &Connection, record: &DownloadRecord) -> Result<()> {
    let status_str = serde_json::to_string(&record.status)
        .unwrap()
        .replace("\"", "");
    conn.execute(
        "INSERT INTO downloads (id, url, title, file_path, status, percent, format, format_id, date_added, hidden, error_code, error_message)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        (
            &record.id,
            &record.url,
            &record.title,
            &record.file_path,
            &status_str,
            &record.percent,
            &record.format,
            &record.format_id,
            &record.date_added,
            &record.hidden,
            &record.error_code,
            &record.error_message,
        ),
    )?;
    Ok(())
}

pub fn update_download_status(
    conn: &Connection,
    id: &str,
    status: &DownloadStatus,
    percent: f32,
    file_path: Option<&str>,
    error_code: Option<&str>,
    error_message: Option<&str>,
) -> Result<()> {
    let status_str = serde_json::to_string(status).unwrap().replace("\"", "");
    conn.execute(
        "UPDATE downloads 
         SET status = ?1, 
             percent = ?2, 
             file_path = COALESCE(?3, file_path),
             error_code = COALESCE(?4, error_code),
             error_message = COALESCE(?5, error_message)
         WHERE id = ?6",
        (
            &status_str,
            &percent,
            &file_path,
            &error_code,
            &error_message,
            id,
        ),
    )?;
    Ok(())
}

pub fn hide_download(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("UPDATE downloads SET hidden = 1 WHERE id = ?1", [id])?;
    Ok(())
}

pub fn update_status_only(conn: &Connection, id: &str, status: &DownloadStatus) -> Result<()> {
    let status_str = serde_json::to_string(status).unwrap().replace("\"", "");
    conn.execute(
        "UPDATE downloads SET status = ?1 WHERE id = ?2",
        (&status_str, id),
    )?;
    Ok(())
}

#[allow(dead_code)]
pub fn delete_download(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM downloads WHERE id = ?1", [id])?;
    Ok(())
}

pub fn get_all_downloads(conn: &Connection) -> Result<Vec<DownloadRecord>> {
    let mut stmt = conn.prepare("SELECT id, url, title, file_path, status, percent, format, format_id, date_added, hidden, error_code, error_message FROM downloads WHERE hidden = 0 ORDER BY date_added DESC")?;
    let download_iter = stmt.query_map([], |row| {
        let status_str: String = row.get(4)?;
        let status =
            serde_json::from_str(&format!("\"{}\"", status_str)).unwrap_or(DownloadStatus::Error);

        Ok(DownloadRecord {
            id: row.get(0)?,
            url: row.get(1)?,
            title: row.get(2)?,
            file_path: row.get(3)?,
            status,
            percent: row.get(5)?,
            format: row.get(6)?,
            format_id: row.get(7)?,
            date_added: row.get(8)?,
            hidden: row.get(9)?,
            file_size: None,
            error_code: row.get(10)?,
            error_message: row.get(11)?,
        })
    })?;

    let mut records = Vec::new();
    for download in download_iter {
        records.push(download?);
    }
    Ok(records)
}

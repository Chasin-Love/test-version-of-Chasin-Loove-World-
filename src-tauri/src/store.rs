//! Desktop persistence: universe state JSON + binary payload store, both in
//! the OS app-data directory. The webview frontend reaches these through the
//! `store_*` commands; the semantics mirror src/backend/storage/indexedDB.ts
//! so the adapter swap is invisible to the rest of the app.

use serde::Serialize;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

fn base_dir() -> Result<PathBuf, String> {
    let dir = dirs().ok_or_else(|| "could not resolve app-data dir".to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Public accessor for other modules (realities.rs production fallback).
pub fn app_data_root() -> PathBuf {
    base_dir().unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn payload_dir() -> Result<PathBuf, String> {
    let dir = base_dir()?.join("payloads");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[cfg(target_os = "windows")]
fn dirs() -> Option<PathBuf> {
    std::env::var("APPDATA").ok().map(|d| PathBuf::from(d).join("MyUniverse"))
}

#[cfg(not(target_os = "windows"))]
fn dirs() -> Option<PathBuf> {
    std::env::var("XDG_DATA_HOME")
        .ok()
        .map(|d| PathBuf::from(d).join("MyUniverse"))
        .or_else(|| {
            std::env::var("HOME").ok().map(|h| {
                PathBuf::from(h).join(".local").join("share").join("MyUniverse")
            })
        })
}

/* ------------------------------- state JSON ------------------------------ */

#[derive(Serialize)]
pub struct StateSnapshot {
    pub json: Option<String>,
    pub path: String,
    pub migratedFromWebview: bool,
}

/// Read the persisted universe state. `migratedFromWebview` tells the frontend
/// whether the localStorage `my-universe:v4` snapshot still needs importing.
pub fn state_read() -> Result<StateSnapshot, String> {
    let path = base_dir()?.join("universe-state.json");
    let json = match fs::read_to_string(&path) {
        Ok(s) => Some(s),
        Err(_) => None,
    };
    Ok(StateSnapshot {
        json,
        path: path.to_string_lossy().into_owned(),
        migratedFromWebview: false,
    })
}

/// Atomically write the universe state (tmp file + rename).
pub fn state_write(json: String) -> Result<(), String> {
    let path = base_dir()?.join("universe-state.json");
    let tmp = base_dir()?.join("universe-state.json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

/* ------------------------------- payloads -------------------------------- */

/// Store raw payload bytes under payloads/<id>.bin. Called with the binary
/// body via Tauri's raw IPC (tauri::ipc::Request).
pub fn payload_put(id: String, bytes: Vec<u8>) -> Result<(), String> {
    if id.is_empty() || id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err("invalid payload id".into());
    }
    let path = payload_dir()?.join(format!("{}.bin", id));
    let tmp = payload_dir()?.join(format!("{}.bin.tmp", id));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(&bytes).map_err(|e| e.to_string())?;
        f.sync_all().ok();
    }
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

pub fn payload_get(id: String) -> Result<Option<Vec<u8>>, String> {
    if id.is_empty() || id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err("invalid payload id".into());
    }
    let path = payload_dir()?.join(format!("{}.bin", id));
    match fs::read(&path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(_) => Ok(None),
    }
}

pub fn payload_delete(id: String) -> Result<(), String> {
    if id.is_empty() || id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err("invalid payload id".into());
    }
    let path = payload_dir()?.join(format!("{}.bin", id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn payload_list() -> Result<Vec<String>, String> {
    let dir = payload_dir()?;
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if let Some(name) = entry.file_name().to_str() {
            if let Some(id) = name.strip_suffix(".bin") {
                out.push(id.to_string());
            }
        }
    }
    Ok(out)
}

/// Bytes of every payload on disk — used by the frontend for a quota readout.
#[derive(Serialize)]
pub struct PayloadStats {
    pub count: u64,
    pub totalBytes: u64,
    pub dir: String,
}

pub fn payload_stats() -> Result<PayloadStats, String> {
    let dir = payload_dir()?;
    let mut count = 0u64;
    let mut total = 0u64;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_name().to_string_lossy().ends_with(".bin") {
            if let Ok(meta) = entry.metadata() {
                count += 1;
                total += meta.len();
            }
        }
    }
    Ok(PayloadStats {
        count,
        totalBytes: total,
        dir: dir.to_string_lossy().into_owned(),
    })
}

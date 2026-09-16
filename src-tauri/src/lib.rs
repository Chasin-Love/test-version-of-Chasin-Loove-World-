//! MY UNIVERSE desktop shell — Tauri 2.
//!
//! Three responsibilities:
//! 1. Host the React/Three.js renderer (unchanged) in a native window.
//! 2. Surface the C++ simulation core (compiled into this binary) to the
//!    webview through the `cosmos_*` commands.
//! 3. Provide native storage (state JSON + payload files) and reality-folder
//!    management so the app no longer needs the Express side server.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cosmos;
mod realities;
mod store;

use serde::Deserialize;
use tauri::ipc::Request;

/* ------------------------------ cosmos core ------------------------------ */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeplerBatchArgs {
    a: Vec<f64>,
    eccentricity: Vec<f64>,
    phase: Vec<f64>,
    inclination: Vec<f64>,
    speed: Vec<f64>,
    sim_days: f64,
}

#[tauri::command]
fn cosmos_status() -> serde_json::Value {
    let backend = if cfg!(cosmos_cpp) { "native-cpp" } else { "stub" };
    serde_json::json!({
        "backend": backend,
        "version": cosmos::version_string(),
        "physicsFieldCount": cosmos::PHYSICS_FIELD_COUNT,
    })
}

#[tauri::command]
fn cosmos_kepler_batch(args: KeplerBatchArgs) -> Result<serde_json::Value, String> {
    let n = args.a.len();
    if args.eccentricity.len() != n
        || args.phase.len() != n
        || args.inclination.len() != n
        || args.speed.len() != n
    {
        return Err("kepler batch: mismatched input lengths".into());
    }
    let mut xyz = vec![0f64; n * 3];
    let mut radius = vec![0f64; n];
    let mut anomaly = vec![0f64; n];
    unsafe {
        cosmos::ffi::cosmos_kepler_batch(
            args.a.as_ptr(),
            args.eccentricity.as_ptr(),
            args.phase.as_ptr(),
            args.inclination.as_ptr(),
            args.speed.as_ptr(),
            n as i32,
            args.sim_days,
            xyz.as_mut_ptr(),
            radius.as_mut_ptr(),
            anomaly.as_mut_ptr(),
        );
    }
    Ok(serde_json::json!({
        "xyz": xyz,
        "radius": radius,
        "trueAnomaly": anomaly,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhysicsBatchArgs {
    ids: Vec<String>,
    orbit_a: Vec<f64>,
    radius: Vec<f64>,
    kinds: Vec<i32>,
    has_rings: Vec<i32>,
    phase: Vec<f64>,
    speed: Vec<f64>,
    sim_time_sec: f64,
}

#[tauri::command]
fn cosmos_physics_batch(args: PhysicsBatchArgs) -> Result<serde_json::Value, String> {
    let n = args.ids.len();
    if args.orbit_a.len() != n
        || args.radius.len() != n
        || args.kinds.len() != n
        || args.has_rings.len() != n
        || args.phase.len() != n
        || args.speed.len() != n
    {
        return Err("physics batch: mismatched input lengths".into());
    }
    let c_ids: Vec<std::ffi::CString> = args
        .ids
        .iter()
        .map(|s| std::ffi::CString::new(s.as_str()).unwrap_or_default())
        .collect();
    let id_ptrs: Vec<*const std::ffi::c_char> = c_ids.iter().map(|s| s.as_ptr()).collect();
    let mut out = vec![0f64; n * cosmos::PHYSICS_FIELD_COUNT];
    unsafe {
        cosmos::ffi::cosmos_physics_batch(
            id_ptrs.as_ptr(),
            args.orbit_a.as_ptr(),
            args.radius.as_ptr(),
            args.kinds.as_ptr(),
            args.has_rings.as_ptr(),
            args.phase.as_ptr(),
            args.speed.as_ptr(),
            n as i32,
            args.sim_time_sec,
            out.as_mut_ptr(),
        );
    }
    Ok(serde_json::json!({ "fields": out, "fieldCount": 41 }))
}

#[tauri::command]
fn cosmos_benchmark(n_bodies: i32, iterations: i32) -> Result<f64, String> {
    Ok(unsafe { cosmos::ffi::cosmos_benchmark_rk4(n_bodies, iterations) })
}

#[tauri::command]
fn cosmos_terrain_fbm(x: f64, y: f64) -> Result<f64, String> {
    Ok(unsafe { cosmos::ffi::cosmos_terrain_fbm(x, y) })
}

/* ------------------------------- persistence ----------------------------- */

#[tauri::command]
fn store_state_read() -> Result<serde_json::Value, String> {
    let snap = store::state_read()?;
    Ok(serde_json::json!({
        "json": snap.json,
        "path": snap.path,
        "migratedFromWebview": snap.migratedFromWebview,
    }))
}

#[tauri::command]
fn store_state_write(json: String) -> Result<(), String> {
    store::state_write(json)
}

/// Raw-IPC payload write. The request body is binary:
///   [u16 LE idLen][id UTF-8 bytes][payload bytes]
/// so large media payloads cross the IPC bridge without JSON encoding.
#[tauri::command]
fn store_payload_put(request: Request) -> Result<(), String> {
    let raw: Vec<u8> = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.to_vec(),
        tauri::ipc::InvokeBody::Json(_) => {
            return Err("store_payload_put requires a raw binary body".into())
        }
        _ => return Err("unsupported payload body".into()),
    };
    if raw.len() < 2 {
        return Err("payload body too short".into());
    }
    let id_len = u16::from_le_bytes([raw[0], raw[1]]) as usize;
    if raw.len() < 2 + id_len {
        return Err("payload id length exceeds body".into());
    }
    let id = String::from_utf8(raw[2..2 + id_len].to_vec()).map_err(|_| "invalid id encoding".into())?;
    let bytes = raw[2 + id_len..].to_vec();
    store::payload_put(id, bytes)
}

#[tauri::command]
fn store_payload_get(id: String) -> Result<Option<Vec<u8>>, String> {
    store::payload_get(id)
}

#[tauri::command]
fn store_payload_delete(id: String) -> Result<(), String> {
    store::payload_delete(id)
}

#[tauri::command]
fn store_payload_list() -> Result<Vec<String>, String> {
    store::payload_list()
}

#[tauri::command]
fn store_payload_stats() -> Result<serde_json::Value, String> {
    let s = store::payload_stats()?;
    Ok(serde_json::json!({ "count": s.count, "totalBytes": s.totalBytes, "dir": s.dir }))
}

/* ---------------------------- realities (daemon) -------------------------- */

#[tauri::command]
fn reality_list() -> Result<serde_json::Value, String> {
    let folders = realities::list_folders()?;
    Ok(serde_json::json!({ "success": true, "folders": folders }))
}

#[tauri::command]
fn reality_bin_list() -> Result<serde_json::Value, String> {
    let bin = realities::list_bin()?;
    Ok(serde_json::json!({ "success": true, "bin": bin }))
}

#[tauri::command]
fn reality_move_to_bin(reality_id: Option<String>, folder_name: Option<String>) -> Result<serde_json::Value, String> {
    let moved = realities::move_to_bin(reality_id, folder_name)?;
    Ok(serde_json::json!({ "success": true, "folderMoved": moved }))
}

#[tauri::command]
fn reality_restore(reality_id: Option<String>, folder_name: Option<String>) -> Result<serde_json::Value, String> {
    let restored = realities::restore_from_bin(reality_id, folder_name)?;
    Ok(serde_json::json!({ "success": true, "folderRestored": restored }))
}

#[tauri::command]
fn reality_purge(reality_id: Option<String>, folder_name: Option<String>) -> Result<serde_json::Value, String> {
    realities::purge_from_bin(reality_id, folder_name)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn reality_empty_bin() -> Result<serde_json::Value, String> {
    let count = realities::empty_bin()?;
    Ok(serde_json::json!({ "success": true, "count": count }))
}

#[tauri::command]
fn reality_rename(reality_id: String, new_name: String) -> Result<serde_json::Value, String> {
    let folder = realities::rename_folder(reality_id, new_name)?;
    Ok(serde_json::json!({ "success": true, "newFolderName": folder }))
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
fn reality_create_folder(
    id: Option<String>,
    name: String,
    code_name: Option<String>,
    spectral: Option<String>,
    description: Option<String>,
    color_a: Option<String>,
    color_b: Option<String>,
    star_color: Option<String>,
    bodies: Option<String>,
    entries: Option<String>,
    folder_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let folder = realities::create_folder(
        id,
        name,
        code_name,
        spectral,
        description,
        color_a.unwrap_or_else(|| "#00f5d4".into()),
        color_b.unwrap_or_else(|| "#8b5cf6".into()),
        star_color.unwrap_or_else(|| "#ffeedd".into()),
        bodies.unwrap_or_default(),
        entries.unwrap_or_else(|| "[]".into()),
        folder_name,
    )?;
    Ok(serde_json::json!({ "success": true, "folderName": folder }))
}

/// Daemon status shape compatible with realityDaemon.getStatus() consumers.
#[tauri::command]
fn reality_daemon_status() -> Result<serde_json::Value, String> {
    let folders = realities::list_folders()?;
    let bin = realities::list_bin()?;
    let names: Vec<String> = folders.into_iter().map(|f| f.name).collect();
    let bin_names: Vec<String> = bin.into_iter().map(|b| b.folder_name).collect();
    Ok(serde_json::json!({
        "active": true,
        "backend": "tauri-native",
        "lastScanTime": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as f64,
        "scanCount": 0,
        "activeFolders": names,
        "binFolders": bin_names,
        "operationsLog": [],
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cosmos_status,
            cosmos_kepler_batch,
            cosmos_physics_batch,
            cosmos_benchmark,
            cosmos_terrain_fbm,
            store_state_read,
            store_state_write,
            store_payload_put,
            store_payload_get,
            store_payload_delete,
            store_payload_list,
            store_payload_stats,
            reality_list,
            reality_bin_list,
            reality_move_to_bin,
            reality_restore,
            reality_purge,
            reality_empty_bin,
            reality_rename,
            reality_create_folder,
            reality_daemon_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

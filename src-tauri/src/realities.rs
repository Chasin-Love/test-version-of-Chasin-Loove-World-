//! Reality folder management — the Tauri port of src/server/realityDaemon.ts
//! with the same sanitize + containment rules as src/server/paths.ts.
//! In dev this operates on the project's src/realities tree; in production the
//! tree lives in the app-data dir (custom realities are always authoritative
//! in localStorage — the disk mirror is a developer convenience).

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

fn sanitize_folder_name(raw: &str) -> String {
    let segment: String = raw.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_').collect();
    if segment.is_empty() || segment == "." || segment == ".." {
        String::new()
    } else {
        segment
    }
}

fn is_inside(parent: &Path, child: &Path) -> bool {
    match (parent.canonicalize(), child.canonicalize()) {
        (Ok(p), Ok(c)) => c.starts_with(&p) && c != p,
        _ => false,
    }
}

fn realities_dir() -> Result<PathBuf, String> {
    // 1. Explicit override (dev convenience / CI).
    if let Ok(dir) = std::env::var("MYU_REALITIES_DIR") {
        let p = PathBuf::from(dir);
        fs::create_dir_all(&p).map_err(|e| e.to_string())?;
        return Ok(p);
    }
    // 2. Dev: the project tree two levels above src-tauri.
    if let Ok(cwd) = std::env::current_dir() {
        let candidate = cwd.join("..").join("src").join("realities");
        if candidate.join("solPrime").exists() || candidate.is_dir() {
            return Ok(candidate);
        }
    }
    // 3. Production: app-data mirror.
    let dir = crate::store::app_data_root().join("realities");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn bin_dir() -> Result<PathBuf, String> {
    let dir = realities_dir()?.join("bin");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[derive(Serialize)]
pub struct FolderInfo {
    pub name: String,
    #[serde(rename = "hasIndex")]
    pub has_index: bool,
    #[serde(rename = "hasSurface")]
    pub has_surface: bool,
}

#[derive(Serialize)]
pub struct BinInfo {
    #[serde(rename = "folderName")]
    pub folder_name: String,
    #[serde(rename = "trashedAt")]
    pub trashed_at: f64,
}

fn is_protected(name: &str) -> bool {
    name == "solPrime" || name == "sol-prime" || name == "bin" || name == ".bin"
}

fn resolve_folder(folder_name: Option<&str>, reality_id: Option<&str>) -> Result<String, String> {
    let dir = realities_dir()?;
    let items = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let mut fallback = String::new();
    for entry in items.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !entry.path().is_dir() || is_protected(&name) {
            continue;
        }
        if let Some(f) = folder_name {
            if name.eq_ignore_ascii_case(f) {
                return Ok(name);
            }
        }
        if let Some(rid) = reality_id {
            let clean = |s: &str| -> String { s.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase() };
            if clean(&name) == clean(rid) || name == rid {
                return Ok(name);
            }
        }
    }
    if let Some(f) = folder_name {
        fallback = sanitize_folder_name(f);
    }
    if fallback.is_empty() {
        return Err(format!("No folder found for {}", reality_id.or(folder_name).unwrap_or("?")));
    }
    Ok(fallback)
}

pub fn list_folders() -> Result<Vec<FolderInfo>, String> {
    let dir = realities_dir()?;
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !entry.path().is_dir() || is_protected(&name) {
            continue;
        }
        out.push(FolderInfo {
            has_index: entry.path().join("index.ts").exists(),
            has_surface: entry.path().join("surface.ts").exists(),
            name,
        });
    }
    Ok(out)
}

pub fn list_bin() -> Result<Vec<BinInfo>, String> {
    let dir = bin_dir()?;
    let mut out = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let trashed = entry
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as f64)
            .unwrap_or(0.0);
        out.push(BinInfo {
            folder_name: entry.file_name().to_string_lossy().into_owned(),
            trashed_at: trashed,
        });
    }
    Ok(out)
}

pub fn move_to_bin(reality_id: Option<String>, folder_name: Option<String>) -> Result<String, String> {
    if reality_id.as_deref() == Some("sol-prime")
        || folder_name.as_deref() == Some("solPrime")
        || folder_name.as_deref() == Some("sol-prime")
    {
        return Err("Sol Prime is the primordial anchor and cannot be moved to Bin.".into());
    }
    let target = resolve_folder(folder_name.as_deref(), reality_id.as_deref())?;
    if target == "bin" || target == ".bin" {
        return Err("Refusing to move the bin directory into itself.".into());
    }
    let src = realities_dir()?.join(&target);
    let dst = bin_dir()?.join(&target);
    if !is_inside(&realities_dir()?, &src) || !is_inside(&bin_dir()?, &dst) {
        return Err("Resolved path escaped the realities tree; refused.".into());
    }
    if !src.exists() {
        return Err(format!("Directory {} does not exist.", src.display()));
    }
    if dst.exists() {
        fs::remove_dir_all(&dst).map_err(|e| e.to_string())?;
    }
    fs::rename(&src, &dst).map_err(|e| e.to_string())?;
    Ok(target)
}

pub fn restore_from_bin(reality_id: Option<String>, folder_name: Option<String>) -> Result<String, String> {
    let dir = bin_dir()?;
    let mut target = String::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(f) = folder_name.as_deref() {
            if name.eq_ignore_ascii_case(f) {
                target = name;
                break;
            }
        }
        if let Some(rid) = reality_id.as_deref() {
            let clean = |s: &str| -> String { s.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase() };
            if clean(&name) == clean(rid) || name == rid {
                target = name;
                break;
            }
        }
    }
    if target.is_empty() {
        return Err(format!("No trashed folder found for {}", reality_id.or(folder_name).unwrap_or("?")));
    }
    let src = bin_dir()?.join(&target);
    let dst = realities_dir()?.join(&target);
    if !is_inside(&bin_dir()?, &src) || !is_inside(&realities_dir()?, &dst) {
        return Err("Resolved path escaped the realities tree; refused.".into());
    }
    if dst.exists() {
        fs::remove_dir_all(&dst).map_err(|e| e.to_string())?;
    }
    fs::rename(&src, &dst).map_err(|e| e.to_string())?;
    Ok(target)
}

pub fn purge_from_bin(reality_id: Option<String>, folder_name: Option<String>) -> Result<(), String> {
    let dir = bin_dir()?;
    let mut target = String::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if let Some(f) = folder_name.as_deref() {
            if name.eq_ignore_ascii_case(f) {
                target = name;
                break;
            }
        }
        if let Some(rid) = reality_id.as_deref() {
            let clean = |s: &str| -> String { s.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase() };
            if clean(&name) == clean(rid) || name == rid {
                target = name;
                break;
            }
        }
    }
    if target.is_empty() {
        return Err("Folder not found in bin".into());
    }
    let path = bin_dir()?.join(&target);
    if !is_inside(&dir, &path) {
        return Err("Resolved path escaped the bin tree; refused.".into());
    }
    fs::remove_dir_all(&path).map_err(|e| e.to_string())
}

pub fn empty_bin() -> Result<u32, String> {
    let dir = bin_dir()?;
    let mut count = 0u32;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let path = entry.path();
        if !is_inside(&dir, &path) {
            continue;
        }
        fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

pub fn rename_folder(reality_id: String, new_name: String) -> Result<String, String> {
    if reality_id == "sol-prime" {
        return Err("Sol Prime cannot be renamed on disk".into());
    }
    let clean_new: String = new_name.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
    if clean_new.is_empty() {
        return Err("New name contains no valid characters.".into());
    }
    let mut chars = clean_new.chars();
    let first = chars.next().unwrap().to_lowercase().next().unwrap();
    let new_folder: String = first.to_string() + &chars.as_str().to_string();

    let dir = realities_dir()?;
    let items = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let mut old = String::new();
    for entry in items.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !entry.path().is_dir() || is_protected(&name) {
            continue;
        }
        let clean = |s: &str| -> String { s.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase() };
        if clean(&name) == clean(&reality_id) || name == reality_id {
            old = name;
            break;
        }
    }
    if old.is_empty() {
        return Err(format!("Could not find reality folder for {}", reality_id));
    }
    if old == new_folder {
        return Ok(new_folder);
    }
    let src = dir.join(&old);
    let dst = dir.join(&new_folder);
    if !is_inside(&dir, &src) || !is_inside(&dir, &dst) {
        return Err("Resolved path escaped the realities tree; refused.".into());
    }
    if dst.exists() {
        fs::remove_dir_all(&dst).map_err(|e| e.to_string())?;
    }
    fs::rename(&src, &dst).map_err(|e| e.to_string())?;

    // Patch the name field in index.ts (same naive regex semantics as the daemon).
    let index_path = dst.join("index.ts");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        if let Some(start) = content.find("name:") {
            if let Some(q1) = content[start..].find(['\'', '"']) {
                let q1 = start + q1;
                let quote = content.as_bytes()[q1] as char;
                if let Some(len) = content[q1 + 1..].find(quote) {
                    let mut patched = String::from(&content[..q1 + 1]);
                    patched.push_str(&new_name.replace('\'', "\\'"));
                    patched.push_str(&content[q1 + 1 + len..]);
                    fs::write(&index_path, patched).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    Ok(new_folder)
}

/// Create a new reality folder on disk with index.ts + surface.ts templates
/// matching the server.ts create-folder generator (UniverseSurfaceConfig
/// schema). Returns the folder name.
#[allow(clippy::too_many_arguments)]
pub fn create_folder(
    id: Option<String>,
    name: String,
    code_name: Option<String>,
    spectral: Option<String>,
    description: Option<String>,
    color_a: String,
    color_b: String,
    star_color: String,
    bodies_json: String,
    entries_json: String,
    folder_name: Option<String>,
) -> Result<String, String> {
    if name.trim().is_empty() {
        return Err("Reality name is required".into());
    }
    let mut folder = folder_name
        .as_deref()
        .map(sanitize_folder_name)
        .unwrap_or_default();
    if folder.is_empty() {
        let raw: String = name
            .trim()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
            .collect();
        let words: Vec<String> = raw
            .split(|c: char| c == ' ' || c == '-' || c == '_')
            .filter(|w| !w.is_empty())
            .enumerate()
            .map(|(i, w)| {
                let lower = w.to_lowercase();
                if i == 0 {
                    lower
                } else {
                    let mut cs = lower.chars();
                    match cs.next() {
                        Some(f) => f.to_uppercase().collect::<String>() + cs.as_str(),
                        None => String::new(),
                    }
                }
            })
            .collect();
        folder = words.join("");
    }
    if folder.is_empty() {
        folder = format!("reality_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());
    }

    let dir = realities_dir()?;
    let target = dir.join(&folder);
    if !is_inside(&dir, &target) {
        return Err("Invalid folder name".into());
    }
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;

    let clean_id = id.unwrap_or_else(|| {
        folder
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
            .collect::<String>()
            .to_lowercase()
    });
    let var_name = format!("{}Reality", folder);
    let surface_var = format!("{}Surface", folder);
    let esc = |s: &str| -> String { serde_json::to_string(s).unwrap_or_else(|_| "\"\"".into()) };

    let surface = format!(
        "import {{ UniverseSurfaceConfig }} from '../../engine/surface/types';\n\nexport const {sv}: UniverseSurfaceConfig = {{\n  realityId: '{cid}',\n  name: {name},\n  colorA: '{ca}',\n  colorB: '{cb}',\n  deepColor: '#030108',\n  starColor: '{sc}',\n  webFilaments: '{ca}',\n  nebulaIntensity: 1.0,\n  dustLaneIntensity: 0.8,\n  starDensity: 0.85,\n}};\n",
        sv = surface_var,
        cid = clean_id,
        name = esc(&name),
        ca = color_a,
        cb = color_b,
        sc = star_color,
    );
    fs::write(target.join("surface.ts"), surface).map_err(|e| e.to_string())?;

    let index = format!(
        "import {{ RealityConfig }} from '../types';\nimport {{ {sv} }} from './surface';\n\nconst day = 86400000;\nconst now = Date.now();\nconst TAU = Math.PI * 2;\n\nexport const {v}: RealityConfig = {{\n  id: '{cid}',\n  name: {name},\n  codeName: {cn},\n  spectral: {sp},\n  description: {desc},\n  bubblePos: [0, 0, 0],\n  bubbleSize: 7500,\n  colorA: '{ca}',\n  colorB: '{cb}',\n  starColor: '{sc}',\n  bodies: {bodies},\n  entries: {entries},\n}};\n\nexport * from './surface';\n",
        sv = surface_var,
        v = var_name,
        cid = clean_id,
        name = esc(&name),
        cn = esc(code_name.as_deref().unwrap_or(&format!("REALITY-{}", folder.to_uppercase()))),
        sp = esc(spectral.as_deref().unwrap_or("Quantum Singularity")),
        desc = esc(description.as_deref().unwrap_or(&format!("The {} continuum realm.", name))),
        ca = color_a,
        cb = color_b,
        sc = star_color,
        bodies = if bodies_json.trim().is_empty() || bodies_json == "[]" {
            default_bodies_json(&clean_id, &name, &color_a, &color_b)
        } else {
            bodies_json
        },
        entries = entries_json,
    );
    fs::write(target.join("index.ts"), index).map_err(|e| e.to_string())?;
    Ok(folder)
}

fn default_bodies_json(clean_id: &str, name: &str, color_a: &str, color_b: &str) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!(
        "[\n    {{\n      id: \"{cid}-core\",\n      name: \"{n} Core Star\",\n      kind: 'star',\n      meaning: null,\n      note: \"The stellar anchor of {n}.\",\n      createdAt: {now},\n      radius: 6.5,\n      palette: {{ deep: '#1c0e35', base: '{ca}', high: '#ffffff', atmo: '{cb}', ice: '#ffffff' }},\n      orbit: {{ a: 0, speed: 0, phase: 0, incl: 0 }},\n    }},\n    {{\n      id: \"{cid}-prime\",\n      name: \"{n} Prime\",\n      kind: 'planet',\n      meaning: 'moment',\n      note: \"The primordial terrestrial world of {n}.\",\n      createdAt: {now},\n      radius: 2.2,\n      clouds: true,\n      nightside: true,\n      palette: {{ deep: '#0c1b33', base: '#10b981', high: '#6ee7b7', atmo: '{ca}', ice: '#e0f2fe' }},\n      orbit: {{ a: 45, speed: Math.PI * 2 / 365, phase: 1.2, incl: 0.04 }},\n    }}\n  ]",
        cid = clean_id,
        n = name,
        ca = color_a,
        cb = color_b,
        now = now
    )
}

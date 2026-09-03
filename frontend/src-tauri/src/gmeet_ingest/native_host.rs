//! Registers the native-messaging host so Chrome/Edge can launch
//! `miting-pairing-host` for the pinned companion extension (doc 15 §4:
//! identity-based pairing — `allowed_origins` is the authorization, no secret
//! shown to the user). Best-effort at startup: failures are logged, never fatal.

use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use tauri::{AppHandle, Manager, Runtime};

#[path = "native_host_layout.rs"]
mod layout;
pub use layout::{browser_manifest_dirs, ChromiumLayout};

#[path = "native_host_register.rs"]
mod register;

pub const HOST_NAME: &str = "com.meetingcapture.host";
/// Stable ID derived from the fixed `key` in extension/manifest.json.
const EXTENSION_ORIGIN: &str = "chrome-extension://abggedoehnlmbcapbfdikhhnkcckhfck/";
fn manifest_json(host_exe: &Path) -> serde_json::Value {
    serde_json::json!({
        "name": HOST_NAME,
        "description": "Miting companion pairing host",
        "path": host_exe.to_string_lossy(),
        "type": "stdio",
        "allowed_origins": [EXTENSION_ORIGIN],
    })
}

/// The pairing-host sidecar ships next to the app executable (tauri externalBin).
fn host_exe_path() -> Result<PathBuf> {
    let dir = std::env::current_exe()
        .context("resolve current exe")?
        .parent()
        .ok_or_else(|| anyhow!("app exe has no parent dir"))?
        .to_path_buf();
    let exe = dir.join(if cfg!(windows) {
        "miting-pairing-host.exe"
    } else {
        "miting-pairing-host"
    });
    if !exe.is_file() {
        return Err(anyhow!(
            "pairing host binary not found at {}",
            exe.display()
        ));
    }
    Ok(exe)
}

/// Write the host manifest into app-data and point browser registries at it.
pub fn install<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    let host_exe = host_exe_path()?;
    let dir = app
        .path()
        .app_data_dir()
        .context("resolve app data dir")?
        .join("native-host");
    std::fs::create_dir_all(&dir).context("create native-host dir")?;
    let manifest_path = dir.join(format!("{HOST_NAME}.json"));
    let manifest = serde_json::to_string_pretty(&manifest_json(&host_exe))?;
    // Borrow, don't move: register_unix below also reads `manifest`, and moving
    // it here only compiled on Windows (where that arm is cfg'd out).
    std::fs::write(&manifest_path, &manifest).context("write host manifest")?;

    #[cfg(target_os = "windows")]
    register::register_windows(&manifest_path)?;
    #[cfg(not(target_os = "windows"))]
    register::register_unix(&manifest)?;

    log::info!(
        "native-messaging host registered: {} -> {}",
        HOST_NAME,
        manifest_path.display()
    );
    Ok(manifest_path)
}

#[cfg(test)]
#[path = "native_host_tests.rs"]
mod tests;

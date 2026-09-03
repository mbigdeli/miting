//! In-app "install the companion extension" flow (Settings → Chrome
//! Extension). The built extension ships inside the app bundle; these commands
//! copy it to a stable app-data folder and help the user through Chrome's
//! "Load unpacked" (no Web Store involved). Pairing itself stays automatic —
//! see `gmeet_ingest::native_host`.

mod browser;
mod digest;
mod error;
mod folder;
mod installer;
mod swap;

pub use error::ExtensionInstallError;

use tauri::{AppHandle, Runtime};

/// Everything the settings card needs to render.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInstallStatus {
    /// Version shipped inside this app build (None = dev build without dist).
    pub bundled_version: Option<String>,
    /// Version currently extracted to `install_path` (None = never installed).
    pub installed_version: Option<String>,
    /// Stable folder the user points Chrome's "Load unpacked" at.
    pub install_path: String,
}

fn status_of<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<ExtensionInstallStatus, ExtensionInstallError> {
    let install_dir = installer::install_dir(app)?;
    let bundled_version = installer::bundled_dir(app)
        .ok()
        .and_then(|dir| installer::manifest_version(&dir));
    Ok(ExtensionInstallStatus {
        bundled_version,
        installed_version: installer::manifest_version(&install_dir),
        install_path: install_dir.to_string_lossy().into_owned(),
    })
}

/// Settings card state. Async — the two manifest reads touch the filesystem
/// (app-data can live on a slow roaming profile), so keep off the main thread.
#[tauri::command]
pub async fn extension_install_status<R: Runtime>(
    app: AppHandle<R>,
) -> Result<ExtensionInstallStatus, ExtensionInstallError> {
    status_of(&app)
}

/// Copy/refresh the bundled extension into app-data; returns the new status.
#[tauri::command]
pub async fn extension_install_run<R: Runtime>(
    app: AppHandle<R>,
) -> Result<ExtensionInstallStatus, ExtensionInstallError> {
    installer::install(&app)?;
    status_of(&app)
}

/// Reveal the prepared folder in the OS file manager — the reliable way to
/// hand it to Chrome's "Load unpacked", since the path lives under a hidden
/// app-data directory on Windows.
#[tauri::command]
pub async fn extension_install_open_folder<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), ExtensionInstallError> {
    folder::reveal(&installer::install_dir(&app)?)
}

/// Open `chrome://extensions` in the user's Chrome. The typed error makes the
/// UI show the "type it manually" hint instead of failing silently.
#[tauri::command]
pub async fn extension_install_open_browser() -> Result<(), ExtensionInstallError> {
    browser::open_extensions_page()
}

/// Keep the install dir in step with the bundled build at startup, so the
/// folder the settings tab advertises always exists and always matches the
/// running app — the user should never have to press "Prepare" to make the
/// path real. Best effort: a locked folder (Chrome holding it open) just
/// leaves the previous copy in place.
pub fn ensure_prepared<R: Runtime>(app: &AppHandle<R>) {
    let (Ok(bundled), Ok(installed)) = (installer::bundled_dir(app), installer::install_dir(app))
    else {
        log::warn!("extension: could not resolve the extension directories");
        return;
    };
    if installer::manifest_version(&bundled).is_none() {
        return; // dev build without a synced dist
    }
    // A missing manifest means the folder is absent or half-written — a fresh
    // install, or a copy interrupted last run. Digest equality is meaningless
    // there, and skipping on it once left the settings tab pointing Chrome at
    // an empty folder.
    let usable = installer::manifest_version(&installed).is_some();
    if usable && digest::matches(&bundled, &installed) {
        return;
    }
    match installer::install(app) {
        Ok(dir) => log::info!("extension: prepared files at {}", dir.display()),
        Err(e) => log::warn!("extension: could not prepare files: {e}"),
    }
}

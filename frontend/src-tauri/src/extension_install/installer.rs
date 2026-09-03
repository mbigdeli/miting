//! Copies the bundled companion extension into app-data so the user can point
//! Chrome's "Load unpacked" at a stable folder. The bundled (read-only) copy
//! ships under the Tauri resource dir (`resources/extension`, synced from
//! `extension/dist` at build time by `scripts/sync-extension-dist.mjs`); the
//! installed copy lives in app-data so its path never moves across app updates.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

use super::digest;
use super::error::ExtensionInstallError;
use super::swap::{copy_dir, swap_in};

/// Where the bundled extension files live inside the app bundle.
pub fn bundled_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, ExtensionInstallError> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| ExtensionInstallError::Path(e.to_string()))?;
    // Array-form resources keep their src-tauri-relative path (same as
    // `templates/*.json` -> `<resources>/templates`).
    Ok(resource_dir.join("resources").join("extension"))
}

/// Stable install target — the folder the user pastes into "Load unpacked".
pub fn install_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, ExtensionInstallError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| ExtensionInstallError::Path(e.to_string()))?;
    Ok(data_dir.join("extension"))
}

/// Read `"version"` from a directory's manifest.json; None = not an extension.
pub fn manifest_version(dir: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(dir.join("manifest.json")).ok()?;
    let json: serde_json::Value = serde_json::from_str(&raw).ok()?;
    json.get("version")?.as_str().map(str::to_owned)
}

/// Refresh the install dir from the bundled copy — same path across updates,
/// so Chrome picks new files up on its next start and the user never repeats
/// "Load unpacked". Staged: the live dir is only touched once a complete new
/// tree exists, and only via directory renames (atomic-or-error — a lock held
/// by Chrome/AV fails the swap cleanly instead of half-deleting the install).
pub fn install<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, ExtensionInstallError> {
    let src = bundled_dir(app)?;
    if manifest_version(&src).is_none() {
        return Err(ExtensionInstallError::NotBundled);
    }
    let dest = install_dir(app)?;
    let staging = dest.with_extension("staging");
    let _ = std::fs::remove_dir_all(&staging);
    copy_dir(&src, &staging).map_err(|e| ExtensionInstallError::Copy(e.to_string()))?;
    swap_in(&staging, &dest).map_err(|e| ExtensionInstallError::Swap(e.to_string()))?;
    // Verify rather than assume: a rename can report success while the result
    // is unreadable (AV quarantine, a redirected roaming profile that silently
    // drops files). Whatever the app advertises has to be loadable by Chrome.
    if manifest_version(&dest).is_none() {
        return Err(ExtensionInstallError::Unverified(
            dest.to_string_lossy().into_owned(),
        ));
    }
    digest::stamp(&src, &dest);
    Ok(dest)
}

#[cfg(test)]
#[path = "installer_tests.rs"]
mod tests;

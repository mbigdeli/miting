//! Pointing each browser at the manifest.
//!
//! Windows keeps a registry entry; everyone else scans directories. Split
//! from `native_host` so neither half hides the other.

#![allow(unused_imports)]

use anyhow::{anyhow, Context, Result};
use std::path::{Path, PathBuf};

use super::{browser_manifest_dirs, ChromiumLayout, HOST_NAME};

/// HKCU (per-user, no elevation) registry roots per Chromium browser.
#[cfg(target_os = "windows")]
const BROWSER_REGISTRY_ROOTS: [&str; 2] = [
    r"Software\Google\Chrome\NativeMessagingHosts",
    r"Software\Microsoft\Edge\NativeMessagingHosts",
];

/// Copy the manifest into every Chromium profile directory that might read it.
///
/// Missing browsers are not an error — a machine usually has one of these — so a
/// directory that cannot be created is skipped rather than failing the install.
/// Registration quietly doing nothing here is why the companion could not pair
/// at all outside Windows: the manifest went to app-data, where no browser looks.
#[cfg(not(target_os = "windows"))]
pub fn register_unix(manifest: &str) -> Result<()> {
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| anyhow!("HOME is not set"))?;
    let layout = if cfg!(target_os = "macos") {
        ChromiumLayout::MacOs
    } else {
        ChromiumLayout::Xdg
    };
    let mut written = 0usize;
    for dir in browser_manifest_dirs(&home, layout) {
        // A browser the user does not have is not an error.
        if std::fs::create_dir_all(&dir).is_err() {
            continue;
        }
        let path = dir.join(format!("{HOST_NAME}.json"));
        if std::fs::write(&path, manifest).is_ok() {
            written += 1;
            log::info!("native-messaging manifest written to {}", path.display());
        }
    }
    if written == 0 {
        return Err(anyhow!("no Chromium native-messaging directory was writable"));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn register_windows(manifest_path: &Path) -> Result<()> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    for root in BROWSER_REGISTRY_ROOTS {
        let (key, _) = hkcu
            .create_subkey(format!(r"{root}\{HOST_NAME}"))
            .with_context(|| format!("create registry key under {root}"))?;
        key.set_value::<String, _>("", &manifest_path.to_string_lossy().to_string())
            .with_context(|| format!("set manifest path under {root}"))?;
    }
    Ok(())
}

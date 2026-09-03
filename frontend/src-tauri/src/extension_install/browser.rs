//! Launch the user's Chrome on `chrome://extensions` so the "Load unpacked"
//! guide starts on the right page. Best effort: a typed error tells the UI to
//! show the type-the-address-manually fallback. `rundll32`/`open <url>` can't
//! be used here — `chrome://` is not a registered OS URL scheme, so the
//! browser binary must be spawned directly (Chrome's own process singleton
//! forwards the URL to a running instance).

use std::path::PathBuf;

use super::error::ExtensionInstallError;

pub const EXTENSIONS_URL: &str = "chrome://extensions/";

pub fn open_extensions_page() -> Result<(), ExtensionInstallError> {
    let exe = chrome_exe().ok_or(ExtensionInstallError::BrowserNotFound)?;
    std::process::Command::new(exe)
        .arg(EXTENSIONS_URL)
        .spawn()
        .map(|_| ())
        .map_err(|e| ExtensionInstallError::BrowserLaunch(e.to_string()))
}

#[cfg(target_os = "windows")]
fn chrome_exe() -> Option<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    // The installer registers the canonical location here for every channel.
    const APP_PATH: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe";
    for root in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        if let Ok(key) = RegKey::predef(root).open_subkey(APP_PATH) {
            if let Ok(path) = key.get_value::<String, _>("") {
                let p = PathBuf::from(path);
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    // Fallback: default install locations (system-wide, 32-bit, per-user).
    for var in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Some(base) = std::env::var_os(var) {
            let p = PathBuf::from(base).join(r"Google\Chrome\Application\chrome.exe");
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn chrome_exe() -> Option<PathBuf> {
    let p = PathBuf::from("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    p.is_file().then_some(p)
}

#[cfg(all(unix, not(target_os = "macos")))]
fn chrome_exe() -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        for name in [
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
        ] {
            let p = dir.join(name);
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

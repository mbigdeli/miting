//! Pairing payload: the ingest base URL + per-install token.
//!
//! Reads (or mints, first run) the SAME token file the desktop app's ingest
//! server uses — `gmeet_ingest::load_or_create_token` in the app — so whichever
//! side runs first, both ends agree. Format mirrors the app: 64 hex chars.

use std::path::{Path, PathBuf};

pub const BASE_URL: &str = "http://127.0.0.1:5167";
const APP_ID: &str = "li.bigde.miting";
const TOKEN_FILE: &str = "gmeet_pairing_token.txt";
/// Test hook: overrides the app-data directory the token file lives in.
pub const DIR_ENV_OVERRIDE: &str = "MITING_PAIRING_DIR";

/// OS layout of Tauri's `app_data_dir` for identifier `li.bigde.miting`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TokenOs {
    Windows,
    MacOs,
    Unix,
}

fn host_os() -> TokenOs {
    if cfg!(windows) {
        TokenOs::Windows
    } else if cfg!(target_os = "macos") {
        TokenOs::MacOs
    } else {
        TokenOs::Unix
    }
}

/// Directory that holds `gmeet_pairing_token.txt`, matching the desktop app.
///
/// Windows: `%APPDATA%\li.bigde.miting`
/// macOS: `~/Library/Application Support/li.bigde.miting`
/// Linux: `$XDG_DATA_HOME/li.bigde.miting` or `~/.local/share/li.bigde.miting`
fn token_dir_for(
    override_dir: Option<&str>,
    appdata: Option<&Path>,
    home: Option<&Path>,
    xdg_data_home: Option<&Path>,
    os: TokenOs,
) -> Option<PathBuf> {
    if let Some(dir) = override_dir {
        if !dir.trim().is_empty() {
            return Some(PathBuf::from(dir));
        }
    }
    match os {
        TokenOs::Windows => appdata.map(|d| d.join(APP_ID)),
        TokenOs::MacOs => home.map(|h| h.join("Library/Application Support").join(APP_ID)),
        TokenOs::Unix => xdg_data_home
            .filter(|p| !p.as_os_str().is_empty())
            .map(|p| p.join(APP_ID))
            .or_else(|| home.map(|h| h.join(".local/share").join(APP_ID))),
    }
}

fn token_dir() -> Option<PathBuf> {
    let override_dir = std::env::var(DIR_ENV_OVERRIDE).ok();
    let appdata = std::env::var_os("APPDATA").map(PathBuf::from);
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let xdg = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from);
    token_dir_for(
        override_dir.as_deref(),
        appdata.as_deref(),
        home.as_deref(),
        xdg.as_deref(),
        host_os(),
    )
}

fn mint_token() -> String {
    let a = uuid::Uuid::new_v4().simple().to_string();
    let b = uuid::Uuid::new_v4().simple().to_string();
    format!("{a}{b}")
}

/// Load the shared pairing token, creating and persisting one on first run.
pub fn load_or_create_token() -> std::io::Result<String> {
    let dir = token_dir().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, "no app-data directory")
    })?;
    let path = dir.join(TOKEN_FILE);
    if let Ok(existing) = std::fs::read_to_string(&path) {
        let trimmed = existing.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }
    let token = mint_token();
    std::fs::create_dir_all(&dir)?;
    std::fs::write(&path, &token)?;
    Ok(token)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct DirGuard;
    impl Drop for DirGuard {
        fn drop(&mut self) {
            std::env::remove_var(DIR_ENV_OVERRIDE);
        }
    }

    #[test]
    fn mac_uses_application_support() {
        let dir = token_dir_for(
            None,
            None,
            Some(Path::new("/Users/sam")),
            None,
            TokenOs::MacOs,
        );
        assert_eq!(
            dir,
            Some(PathBuf::from(
                "/Users/sam/Library/Application Support/li.bigde.miting"
            ))
        );
    }

    #[test]
    fn windows_uses_appdata() {
        let appdata = Path::new(r"C:\Users\sam\AppData\Roaming");
        let dir = token_dir_for(None, Some(appdata), None, None, TokenOs::Windows);
        assert_eq!(dir, Some(appdata.join(APP_ID)));
    }

    #[test]
    fn linux_prefers_xdg_then_local_share() {
        let xdg = token_dir_for(
            None,
            None,
            Some(Path::new("/home/sam")),
            Some(Path::new("/custom/data")),
            TokenOs::Unix,
        );
        assert_eq!(xdg, Some(PathBuf::from("/custom/data/li.bigde.miting")));

        let fallback = token_dir_for(
            None,
            None,
            Some(Path::new("/home/sam")),
            None,
            TokenOs::Unix,
        );
        assert_eq!(
            fallback,
            Some(PathBuf::from("/home/sam/.local/share/li.bigde.miting"))
        );
    }

    #[test]
    fn override_wins_on_every_os() {
        for os in [TokenOs::Windows, TokenOs::MacOs, TokenOs::Unix] {
            let dir = token_dir_for(Some("/tmp/override"), None, None, None, os);
            assert_eq!(dir, Some(PathBuf::from("/tmp/override")), "{os:?}");
        }
    }

    #[test]
    fn reads_existing_token_and_mints_when_absent() {
        let tmp = std::env::temp_dir().join(format!("pairing-host-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::env::set_var(DIR_ENV_OVERRIDE, &tmp);
        let _guard = DirGuard;

        let minted = load_or_create_token().unwrap();
        assert_eq!(minted.len(), 64, "app token format is 64 hex chars");
        let reread = load_or_create_token().unwrap();
        assert_eq!(minted, reread, "second read returns the persisted token");

        std::fs::write(tmp.join(TOKEN_FILE), "  fixed-token\n").unwrap();
        assert_eq!(load_or_create_token().unwrap(), "fixed-token", "existing file wins, trimmed");

        let _ = std::fs::remove_dir_all(&tmp);
    }
}

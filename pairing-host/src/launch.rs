//! `app.launch` — start the Miting desktop app from the native host.
//!
//! Chrome spawns this host even when the desktop app is closed, so the
//! extension can offer "Open Miting" instead of dead-ending on "desktop app
//! unavailable". The app binary ships in the same directory as this host
//! (tauri `externalBin`), so launching is: spawn the sibling executable,
//! fully detached from the host's stdio (which is Chrome's message pipe).
//! If the app is already running its single-instance plugin focuses the
//! existing window, so a duplicate launch is harmless.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Candidate sibling binary names: installed name first, dev-build name second.
#[cfg(windows)]
// Newest name first; the older two let the host still launch an
// installation that predates the miting rename.
const APP_BINARY_NAMES: [&str; 3] = ["miting.exe", "Miting.exe", "meetily.exe"];
#[cfg(not(windows))]
const APP_BINARY_NAMES: [&str; 3] = ["miting", "Miting", "meetily"];

/// First candidate app binary that exists in `dir`, if any.
fn find_app_exe(dir: &Path) -> Option<PathBuf> {
    APP_BINARY_NAMES
        .iter()
        .map(|name| dir.join(name))
        .find(|p| p.is_file())
}

fn host_dir() -> Result<PathBuf, String> {
    Ok(std::env::current_exe()
        .map_err(|e| format!("resolve host exe: {e}"))?
        .parent()
        .ok_or("host exe has no parent dir")?
        .to_path_buf())
}

/// Spawn the app detached. The child must NOT inherit this process's stdio:
/// stdin/stdout are Chrome's native-messaging pipes and the host exits as soon
/// as the extension disconnects.
fn spawn_detached(exe: &Path) -> Result<u32, String> {
    let mut cmd = Command::new(exe);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(dir) = exe.parent() {
        cmd.current_dir(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        cmd.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }
    let child = cmd
        .spawn()
        .map_err(|e| format!("spawn {}: {e}", exe.display()))?;
    Ok(child.id())
}

/// Handle the `app.launch` action: find and start the desktop app.
pub fn launch_app() -> Result<serde_json::Value, String> {
    let dir = host_dir()?;
    let exe = find_app_exe(&dir)
        .ok_or_else(|| format!("app binary not found next to host in {}", dir.display()))?;
    let pid = spawn_detached(&exe)?;
    Ok(serde_json::json!({
        "launched": true,
        "exe": exe.to_string_lossy(),
        "pid": pid,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("miting_launch_{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn empty_dir_has_no_app_binary() {
        let dir = temp_dir("empty");
        assert_eq!(find_app_exe(&dir), None);
    }

    #[test]
    fn prefers_installed_name_over_dev_name() {
        let dir = temp_dir("both");
        for name in APP_BINARY_NAMES {
            std::fs::write(dir.join(name), b"stub").unwrap();
        }
        let found = find_app_exe(&dir).unwrap();
        assert!(
            found.ends_with(APP_BINARY_NAMES[0]),
            "found: {}",
            found.display()
        );
    }

    #[test]
    fn falls_back_to_later_candidate() {
        let dir = temp_dir("dev_only");
        // "miting" and "Miting" are the same file on default macOS APFS.
        // Use a name that is not a case-variant of the preferred binary.
        let fallback = APP_BINARY_NAMES
            .iter()
            .copied()
            .find(|name| !name.eq_ignore_ascii_case(APP_BINARY_NAMES[0]))
            .expect("a distinct fallback binary name");
        std::fs::write(dir.join(fallback), b"stub").unwrap();
        let found = find_app_exe(&dir).unwrap();
        assert!(found.ends_with(fallback), "found: {}", found.display());
    }
}

//! Reveal the prepared extension folder in the OS file manager.
//!
//! Copying the path to the clipboard is not enough on Windows: the install dir
//! lives under `%APPDATA%`, which Explorer hides by default, so users who
//! pasted the path reported that the folder "does not exist". Opening it
//! directly removes that whole class of confusion — and Chrome's "Load
//! unpacked" picker accepts a folder dragged or navigated to from there.

use std::path::Path;

use super::error::ExtensionInstallError;

pub fn reveal(dir: &Path) -> Result<(), ExtensionInstallError> {
    if !dir.is_dir() {
        return Err(ExtensionInstallError::NotPrepared);
    }
    spawn_file_manager(dir).map_err(|e| ExtensionInstallError::OpenFolder(e.to_string()))
}

#[cfg(target_os = "windows")]
fn spawn_file_manager(dir: &Path) -> std::io::Result<()> {
    std::process::Command::new("explorer").arg(dir).spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn spawn_file_manager(dir: &Path) -> std::io::Result<()> {
    std::process::Command::new("open").arg(dir).spawn()?;
    Ok(())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn spawn_file_manager(dir: &Path) -> std::io::Result<()> {
    std::process::Command::new("xdg-open").arg(dir).spawn()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reveal_rejects_a_folder_that_was_never_prepared() {
        let tmp = tempfile::tempdir().unwrap();
        let missing = tmp.path().join("extension");
        assert!(matches!(
            reveal(&missing),
            Err(ExtensionInstallError::NotPrepared)
        ));
    }
}

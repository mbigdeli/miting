//! Replacing the prepared folder without ever leaving it half-written.
//!
//! Chrome (or AV) can hold the live folder open, so the new tree is built
//! alongside it and moved in by directory rename: atomic-or-error, rather than
//! a delete-then-copy that could strand the user with nothing to load.

use std::path::Path;

/// Move `dest` aside (unique name — best-effort cleanup can fail and retry on
/// a later install), move the staged tree into place, then sweep leftovers.
pub(super) fn swap_in(staging: &Path, dest: &Path) -> std::io::Result<()> {
    let retired = dest.with_extension(format!("old-{}", unix_millis()));
    if dest.exists() {
        std::fs::rename(dest, &retired)?;
    }
    std::fs::rename(staging, dest)?;
    let _ = std::fs::remove_dir_all(&retired);
    sweep_retired(dest);
    Ok(())
}

fn unix_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Best-effort removal of `extension.old-*` dirs a previous locked swap left.
fn sweep_retired(dest: &Path) {
    let (Some(parent), Some(name)) = (dest.parent(), dest.file_name()) else {
        return;
    };
    let prefix = format!("{}.old-", name.to_string_lossy());
    let Ok(entries) = std::fs::read_dir(parent) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.file_name().to_string_lossy().starts_with(&prefix) {
            let _ = std::fs::remove_dir_all(entry.path());
        }
    }
}

/// Recursive copy that skips dotfiles (the `.gitkeep` bundling placeholder
/// must never ship to Chrome).
pub(super) fn copy_dir(src: &Path, dest: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dest)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let name = entry.file_name();
        if name.to_string_lossy().starts_with('.') {
            continue;
        }
        let target = dest.join(&name);
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

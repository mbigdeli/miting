//! Content fingerprint of an extension tree.
//!
//! The manifest `version` is not enough to decide whether the installed copy
//! is current: files get added and removed between builds that keep the same
//! version, and a stale install then keeps serving pages the app no longer
//! ships. The digest is stamped into the install dir after each copy, so a
//! changed bundle is detected even when the version string never moves.

use std::path::Path;

use sha2::{Digest, Sha256};

/// Filename of the stamp written next to the copied files. Dotted so
/// `copy_dir` (which skips dotfiles) never propagates it into a new tree.
pub const STAMP_FILE: &str = ".miting-source";

/// SHA-256 over every non-dotfile's relative path and bytes, in stable order.
pub fn tree_digest(root: &Path) -> std::io::Result<String> {
    let mut hasher = Sha256::new();
    hash_dir(root, "", &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

fn hash_dir(dir: &Path, prefix: &str, hasher: &mut Sha256) -> std::io::Result<()> {
    let mut entries: Vec<_> = std::fs::read_dir(dir)?.collect::<Result<_, _>>()?;
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let key = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{prefix}/{name}")
        };
        if entry.file_type()?.is_dir() {
            hash_dir(&entry.path(), &key, hasher)?;
        } else {
            hasher.update(key.as_bytes());
            hasher.update(std::fs::read(entry.path())?);
        }
    }
    Ok(())
}

/// Digest recorded when this tree was installed; None = never stamped.
pub fn read_stamp(dir: &Path) -> Option<String> {
    std::fs::read_to_string(dir.join(STAMP_FILE))
        .ok()
        .map(|s| s.trim().to_owned())
}

pub fn write_stamp(dir: &Path, digest: &str) -> std::io::Result<()> {
    std::fs::write(dir.join(STAMP_FILE), digest)
}

/// Record what was just copied. Best effort: a missing stamp only costs one
/// redundant copy on the next launch.
pub fn stamp(src: &Path, dest: &Path) {
    if let Ok(digest) = tree_digest(src) {
        let _ = write_stamp(dest, &digest);
    }
}

/// Does `dest` hold exactly the tree `src` ships? A missing stamp means it was
/// installed by an older build, so treat it as stale.
pub fn matches(src: &Path, dest: &Path) -> bool {
    matches!(
        (tree_digest(src), read_stamp(dest)),
        (Ok(bundled), Some(installed)) if bundled == installed
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(path: &Path, contents: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, contents).unwrap();
    }

    #[test]
    fn identical_trees_share_a_digest() {
        let tmp = tempfile::tempdir().unwrap();
        for name in ["a", "b"] {
            write(&tmp.path().join(name).join("manifest.json"), "{}");
            write(&tmp.path().join(name).join("sub").join("x.js"), "js");
        }
        let a = tree_digest(&tmp.path().join("a")).unwrap();
        assert_eq!(a, tree_digest(&tmp.path().join("b")).unwrap());
    }

    #[test]
    fn removing_a_file_changes_the_digest() {
        // The real regression: same manifest version, fewer files shipped.
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("ext");
        write(&dir.join("manifest.json"), r#"{"version":"0.1.0"}"#);
        write(&dir.join("options.js"), "old page");
        let before = tree_digest(&dir).unwrap();

        std::fs::remove_file(dir.join("options.js")).unwrap();
        assert_ne!(before, tree_digest(&dir).unwrap());
    }

    #[test]
    fn editing_a_file_changes_the_digest() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("ext");
        write(&dir.join("popup.js"), "one");
        let before = tree_digest(&dir).unwrap();
        write(&dir.join("popup.js"), "two");
        assert_ne!(before, tree_digest(&dir).unwrap());
    }

    #[test]
    fn the_stamp_itself_is_not_hashed() {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("ext");
        write(&dir.join("popup.js"), "one");
        let bare = tree_digest(&dir).unwrap();
        write_stamp(&dir, &bare).unwrap();
        assert_eq!(bare, tree_digest(&dir).unwrap());
        assert_eq!(read_stamp(&dir).as_deref(), Some(bare.as_str()));
    }
}

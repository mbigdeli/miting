//! Filesystem primitives for database recovery: enumerate the rolling
//! pre-migration snapshots written by [`super::backup`], move a broken DB
//! aside, and copy a snapshot back into place.
//!
//! Kept free of `AppHandle` so every operation is unit-testable on a temp dir.

use serde::Serialize;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const DB_FILE: &str = "meeting_minutes.sqlite";
const SIDECAR_SUFFIXES: [&str; 2] = ["-wal", "-shm"];
const BACKUP_PREFIX: &str = "meeting_minutes-";
const BACKUP_SUFFIX: &str = ".sqlite";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub file_name: String,
    pub size_bytes: u64,
    /// Snapshot mtime as Unix seconds; the UI renders this as "restores you to …".
    pub modified_secs: u64,
}

pub fn backups_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("backups")
}

/// Newest snapshot first. Missing/unreadable dir yields an empty list — a user
/// whose DB broke before any migration was pending legitimately has none.
pub fn list_backups(app_data_dir: &Path) -> Vec<BackupInfo> {
    let Ok(entries) = fs::read_dir(backups_dir(app_data_dir)) else {
        return Vec::new();
    };
    let mut backups: Vec<BackupInfo> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_str()?.to_string();
            if !is_backup_name(&name) {
                return None;
            }
            let meta = entry.metadata().ok()?;
            Some(BackupInfo {
                file_name: name,
                size_bytes: meta.len(),
                modified_secs: mtime_secs(&meta),
            })
        })
        .collect();
    backups.sort_by(|a, b| b.modified_secs.cmp(&a.modified_secs));
    backups
}

/// Move the live DB (and its WAL/SHM sidecars) aside so a fresh open cannot
/// inherit the broken state. Returns the quarantined path, or `None` when
/// there was no DB file to move.
pub fn quarantine_db(app_data_dir: &Path, stamp: u64) -> io::Result<Option<PathBuf>> {
    let live = app_data_dir.join(DB_FILE);
    for suffix in SIDECAR_SUFFIXES {
        let sidecar = app_data_dir.join(format!("{DB_FILE}{suffix}"));
        if sidecar.exists() {
            let _ = fs::remove_file(&sidecar);
        }
    }
    if !live.exists() {
        return Ok(None);
    }
    let broken = app_data_dir.join(format!("{DB_FILE}.broken-{stamp}"));
    fs::rename(&live, &broken)?;
    Ok(Some(broken))
}

/// Quarantine the live DB, then copy `file_name` from `backups/` into place.
/// `file_name` is validated against the backup naming scheme, so a caller
/// cannot walk out of the backups directory.
pub fn restore_backup(app_data_dir: &Path, file_name: &str, stamp: u64) -> io::Result<()> {
    if !is_backup_name(file_name) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("not a recognized backup file name: {file_name}"),
        ));
    }
    let source = backups_dir(app_data_dir).join(file_name);
    if !source.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("backup not found: {file_name}"),
        ));
    }
    quarantine_db(app_data_dir, stamp)?;
    fs::copy(&source, app_data_dir.join(DB_FILE))?;
    Ok(())
}

/// Rejects path separators and traversal, so only plain snapshot names pass.
fn is_backup_name(name: &str) -> bool {
    name.starts_with(BACKUP_PREFIX)
        && name.ends_with(BACKUP_SUFFIX)
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
}

fn mtime_secs(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(name);
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn seed_backup(dir: &Path, name: &str, body: &[u8]) {
        let bdir = backups_dir(dir);
        fs::create_dir_all(&bdir).unwrap();
        fs::write(bdir.join(name), body).unwrap();
    }

    #[test]
    fn list_backups_empty_without_dir() {
        let dir = scratch("miting_rec_empty");
        assert!(list_backups(&dir).is_empty());
    }

    #[test]
    fn list_backups_reports_size_and_skips_foreign_files() {
        let dir = scratch("miting_rec_list");
        seed_backup(&dir, "meeting_minutes-100.sqlite", b"aaaa");
        seed_backup(&dir, "notes.txt", b"nope");
        let found = list_backups(&dir);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].file_name, "meeting_minutes-100.sqlite");
        assert_eq!(found[0].size_bytes, 4);
    }

    #[test]
    fn quarantine_moves_db_and_clears_sidecars() {
        let dir = scratch("miting_rec_quarantine");
        fs::write(dir.join(DB_FILE), b"live").unwrap();
        fs::write(dir.join(format!("{DB_FILE}-wal")), b"wal").unwrap();
        fs::write(dir.join(format!("{DB_FILE}-shm")), b"shm").unwrap();

        let moved = quarantine_db(&dir, 42).unwrap().unwrap();

        assert!(!dir.join(DB_FILE).exists());
        assert!(!dir.join(format!("{DB_FILE}-wal")).exists());
        assert!(!dir.join(format!("{DB_FILE}-shm")).exists());
        assert_eq!(fs::read(moved).unwrap(), b"live");
    }

    #[test]
    fn quarantine_is_noop_without_db() {
        let dir = scratch("miting_rec_quarantine_none");
        assert!(quarantine_db(&dir, 7).unwrap().is_none());
    }

    #[test]
    fn restore_replaces_live_db_and_keeps_broken_copy() {
        let dir = scratch("miting_rec_restore");
        fs::write(dir.join(DB_FILE), b"broken").unwrap();
        seed_backup(&dir, "meeting_minutes-900.sqlite", b"good");

        restore_backup(&dir, "meeting_minutes-900.sqlite", 55).unwrap();

        assert_eq!(fs::read(dir.join(DB_FILE)).unwrap(), b"good");
        let broken = dir.join(format!("{DB_FILE}.broken-55"));
        assert_eq!(fs::read(broken).unwrap(), b"broken");
    }

    #[test]
    fn restore_rejects_traversal_and_missing_files() {
        let dir = scratch("miting_rec_restore_bad");
        assert!(restore_backup(&dir, "../meeting_minutes-1.sqlite", 1).is_err());
        assert!(restore_backup(&dir, "meeting_minutes-1.sqlite", 1).is_err());
        // A rejected restore must not have touched the live DB.
        assert!(!dir.join(format!("{DB_FILE}.broken-1")).exists());
    }
}

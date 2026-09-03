//! Tests for the extension installer's path and copy behaviour.

use super::*;
use crate::extension_install::swap::{copy_dir, swap_in};

fn write(path: &Path, contents: &str) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, contents).unwrap();
}

#[test]
fn copy_dir_preserves_structure_and_skips_dotfiles() {
    let tmp = tempfile::tempdir().unwrap();
    let src = tmp.path().join("src");
    write(&src.join("manifest.json"), "{}");
    write(&src.join("assets").join("chunk.js"), "js");
    write(&src.join(".gitkeep"), "");

    let dest = tmp.path().join("dest");
    copy_dir(&src, &dest).unwrap();

    assert!(dest.join("manifest.json").is_file());
    assert!(dest.join("assets").join("chunk.js").is_file());
    assert!(!dest.join(".gitkeep").exists(), "dotfiles must not ship");
}

#[test]
fn a_fresh_machine_gets_the_whole_chain_of_parents() {
    // On a clean install nothing under app-data exists yet. The copy has to
    // build the whole path, or the settings tab advertises a folder that
    // was never created.
    let tmp = tempfile::tempdir().unwrap();
    let src = tmp.path().join("src");
    write(&src.join("manifest.json"), r#"{"version":"0.1.0"}"#);

    let dest = tmp.path().join("never").join("existed").join("extension");
    copy_dir(&src, &dest).unwrap();

    assert_eq!(manifest_version(&dest).as_deref(), Some("0.1.0"));
}

#[test]
fn a_directory_without_a_manifest_is_not_an_extension() {
    // What `install` verifies after the swap, and what `ensure_prepared`
    // treats as "must copy": an unreadable folder must never pass for a
    // prepared one.
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("extension");
    std::fs::create_dir_all(&dir).unwrap();
    assert_eq!(manifest_version(&dir), None);

    write(&dir.join("manifest.json"), "{ not json");
    assert_eq!(
        manifest_version(&dir),
        None,
        "a corrupt manifest is not usable"
    );
}

#[test]
fn swap_in_replaces_dest_and_drops_stale_files() {
    let tmp = tempfile::tempdir().unwrap();
    let dest = tmp.path().join("extension");
    write(&dest.join("manifest.json"), r#"{"version":"0.1.0"}"#);
    write(&dest.join("stale.js"), "old");

    let staging = tmp.path().join("extension.staging");
    write(&staging.join("manifest.json"), r#"{"version":"0.2.0"}"#);
    write(&staging.join("fresh.js"), "new");

    swap_in(&staging, &dest).unwrap();

    assert_eq!(manifest_version(&dest).as_deref(), Some("0.2.0"));
    assert!(dest.join("fresh.js").is_file());
    assert!(
        !dest.join("stale.js").exists(),
        "stale files must not survive a swap"
    );
    assert!(!staging.exists());
    // retired copy swept
    let leftovers: Vec<_> = std::fs::read_dir(tmp.path())
        .unwrap()
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().contains(".old-"))
        .collect();
    assert!(
        leftovers.is_empty(),
        "retired dirs should be swept: {leftovers:?}"
    );
}

#[test]
fn swap_in_works_when_dest_missing() {
    let tmp = tempfile::tempdir().unwrap();
    let staging = tmp.path().join("extension.staging");
    write(&staging.join("manifest.json"), r#"{"version":"0.1.0"}"#);
    let dest = tmp.path().join("extension");
    swap_in(&staging, &dest).unwrap();
    assert_eq!(manifest_version(&dest).as_deref(), Some("0.1.0"));
}

#[test]
fn manifest_version_reads_version_field() {
    let tmp = tempfile::tempdir().unwrap();
    write(&tmp.path().join("manifest.json"), r#"{"version":"0.1.0"}"#);
    assert_eq!(manifest_version(tmp.path()).as_deref(), Some("0.1.0"));
}

#[test]
fn manifest_version_none_when_missing_or_invalid() {
    let tmp = tempfile::tempdir().unwrap();
    assert_eq!(manifest_version(tmp.path()), None);
    write(&tmp.path().join("manifest.json"), "not json");
    assert_eq!(manifest_version(tmp.path()), None);
}

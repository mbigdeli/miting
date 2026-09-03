//! Guards the bytes of already-shipped migrations.
//!
//! sqlx stores a checksum of every applied migration and refuses to open a
//! database whose stored checksum no longer matches the embedded file. Two
//! things have broken users this way:
//!
//! 1. Editing a migration that already shipped (commit be8e5cb did this).
//! 2. Line-ending drift — a CRLF checkout hashes differently from the LF
//!    checkout CI builds from, so a locally-built app and a released app
//!    disagree about the same migration. `.gitattributes` pins `eol=lf`;
//!    this test fails if a file slips through anyway.
//!
//! Both failures used to be a startup panic with no window and no log. When a
//! migration is legitimately added, append its hash below.

use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

/// (file name, first 16 hex chars of the SHA-256 of its raw bytes).
/// Append-only: changing an existing line means changing a shipped migration.
const SHIPPED_MIGRATIONS: &[(&str, &str)] = &[
    ("20250916100000_initial_schema.sql", "1eed8720bfbec937"),
    ("20250920155811_add_openrouter_api_key.sql", "96839c8dd47fa1de"),
    ("20251006000000_add_audio_sync_fields.sql", "eab71c0b67235742"),
    ("20251010153942_add_ollama_endpoint.sql", "72538e9b6c382106"),
    ("20251101000000_add_summary_backup.sql", "e35f579a753f2a30"),
    ("20251105120000_add_pro_license_custom_openai.sql", "1addc77cf5f14b47"),
    ("20251110000000_add_grace_period_to_licensing.sql", "bc8e5ede41ac5d1a"),
    ("20251110000001_add_speaker_field.sql", "fe6d59369e9b994f"),
    ("20251223000000_add_meeting_notes.sql", "bef41b8e452806eb"),
    ("20251229000000_add_gemini_api_key.sql", "57f8116122aa4882"),
    ("20260706000000_add_gmeet_participants.sql", "f8d8df53f4e61504"),
    ("20260707000000_gmeet_diarization.sql", "ad647af6d01d56d0"),
    ("20260708000000_meetings_library.sql", "bc1e4dfdfda8090a"),
    ("20260709000000_meeting_templates.sql", "94162e332a88dd48"),
    ("20260710000000_integration_settings.sql", "06f7cb6fc11413a8"),
    ("20260811000000_meeting_transcription_model.sql", "cd754bcfd351eebc"),
    ("20260829000000_gmeet_caption_blocks.sql", "5c5c9fc2304e7c6a"),
    ("20260830000000_gmeet_session_meta.sql", "d0c1ccb3edc4f1f6"),
];

fn migrations_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("migrations")
}

/// First 16 hex chars of the SHA-256 — enough to catch any real edit while
/// keeping the table above readable.
fn short_hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[test]
fn shipped_migrations_are_byte_for_byte_unchanged() {
    for (name, expected) in SHIPPED_MIGRATIONS {
        let bytes = fs::read(migrations_dir().join(name))
            .unwrap_or_else(|e| panic!("shipped migration {name} is missing: {e}"));
        assert_eq!(
            &short_hash(&bytes),
            expected,
            "{name} changed after shipping. sqlx will refuse to open every \
             database that already applied it. Add a new migration instead."
        );
    }
}

#[test]
fn every_migration_on_disk_is_accounted_for() {
    let mut found: Vec<String> = fs::read_dir(migrations_dir())
        .expect("migrations dir readable")
        .flatten()
        .filter_map(|entry| entry.file_name().to_str().map(str::to_string))
        .filter(|name| name.ends_with(".sql"))
        .collect();
    found.sort();

    let mut known: Vec<String> = SHIPPED_MIGRATIONS
        .iter()
        .map(|(name, _)| (*name).to_string())
        .collect();
    known.sort();

    assert_eq!(
        found, known,
        "a migration was added or removed without updating SHIPPED_MIGRATIONS"
    );
}

#[test]
fn migrations_use_lf_line_endings() {
    for (name, _) in SHIPPED_MIGRATIONS {
        let bytes = fs::read(migrations_dir().join(name)).expect("migration readable");
        assert!(
            !bytes.windows(2).any(|pair| pair == b"\r\n"),
            "{name} has CRLF line endings. Its checksum then differs from the \
             LF checkout CI builds from, so a local build and a release build \
             disagree and the app refuses to start."
        );
    }
}

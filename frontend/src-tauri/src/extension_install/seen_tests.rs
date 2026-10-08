use std::time::{Duration, Instant};

use super::{due, read_at, write_at, WRITE_EVERY};

#[test]
fn first_request_is_always_recorded() {
    assert!(due(None, Instant::now()));
}

#[test]
fn requests_inside_a_minute_are_not_rewritten() {
    let at = Instant::now();
    assert!(!due(Some(at), at + Duration::from_secs(5)));
    assert!(due(Some(at), at + WRITE_EVERY));
}

#[test]
fn time_round_trips_through_the_file() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("nested").join("seen.txt");
    assert_eq!(read_at(&path), None);
    write_at(&path, 1_791_400_000).expect("write");
    assert_eq!(read_at(&path), Some(1_791_400_000));
}

#[test]
fn a_garbled_file_reads_as_never_seen() {
    let dir = tempfile::tempdir().expect("temp dir");
    let path = dir.path().join("seen.txt");
    std::fs::write(&path, "not a time").expect("write");
    assert_eq!(read_at(&path), None);
}

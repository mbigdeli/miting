//! Tests for `grace` — split out to keep that module under the
//! file-length gate.

use super::*;

#[test]
fn three_missed_beats_synthesize_the_pause() {
    assert!(heartbeat_lost(Duration::from_secs(15), false, false));
    assert!(heartbeat_lost(Duration::from_secs(60), false, false));
}

#[test]
fn a_healthy_or_already_pausing_session_is_left_alone() {
    // Still polling.
    assert!(!heartbeat_lost(Duration::from_secs(4), false, false));
    // Properly paused: the goodbye arrived; grace handles it from here.
    assert!(!heartbeat_lost(Duration::from_secs(60), true, false));
    // Already in a grace window: nothing further to synthesize.
    assert!(!heartbeat_lost(Duration::from_secs(60), false, true));
}

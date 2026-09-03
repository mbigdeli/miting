//! A start in flight, and who it belongs to.
//!
//! Since the rewrite the ingest server opens the session at admission and the
//! `starting` flag lives on the session itself — there is no window in which
//! an admitted Meet is invisible to `/gmeet/state`.

use super::state_view_fixtures::{companion, q, starting};
use super::*;

#[test]
fn a_start_in_flight_is_not_reported_as_idle() {
    // The window that produced "Empty miting discarded" on the first try:
    // admitted by the server, recorder not up yet.
    let v = render(q(starting("abc-defg-hij"), false, None, Some("abc-defg-hij")));
    assert_eq!(v.phase, RecordingPhase::Recording);
    assert!(
        v.companion_should_capture,
        "the session it just started must survive"
    );
}

#[test]
fn another_meets_start_does_not_make_this_one_capture() {
    let v = render(q(starting("abc-defg-hij"), false, None, Some("zzz-yyyy-xxx")));
    assert!(!v.companion_should_capture);
}

#[test]
fn a_start_still_attaching_its_code_counts_as_ours() {
    // A companion session with no Meet named yet can only be the asker's own.
    let v = render(q(companion(None), false, None, Some("abc-defg-hij")));
    assert!(v.companion_should_capture);
}

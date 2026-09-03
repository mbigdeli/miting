//! Idle, recording, paused and grace, as the companion sees them.

use super::state_view_fixtures::{companion, local, q, q_leaving};
use super::*;

#[test]
fn an_idle_app_tells_the_companion_to_stop_capturing() {
    let v = render(q(None, false, None, Some("abc-defg-hij")));
    assert_eq!(v.phase, RecordingPhase::Idle);
    assert!(!v.companion_should_capture);
}

#[test]
fn a_local_recording_never_belongs_to_the_companion() {
    let v = render(q(local(), false, None, Some("abc-defg-hij")));
    assert_eq!(v.phase, RecordingPhase::Recording);
    assert_eq!(v.source, Some("local"));
    assert!(
        !v.companion_should_capture,
        "the user is recording something of their own"
    );
}

#[test]
fn the_companion_captures_for_its_own_meet() {
    let v = render(q(
        companion(Some("abc-defg-hij")),
        false,
        None,
        Some("abc-defg-hij"),
    ));
    assert!(v.companion_should_capture);
}

#[test]
fn another_meet_is_told_to_stand_down() {
    let v = render(q(
        companion(Some("abc-defg-hij")),
        false,
        None,
        Some("zzz-yyyy-xxx"),
    ));
    assert!(!v.companion_should_capture);
}

#[test]
fn pausing_in_the_app_stops_the_companion_without_ending_it() {
    let v = render(q(
        companion(Some("abc-defg-hij")),
        true,
        None,
        Some("abc-defg-hij"),
    ));
    assert_eq!(v.phase, RecordingPhase::Paused);
    assert!(!v.companion_should_capture);
}

#[test]
fn a_left_meet_reports_its_grace_window() {
    let v = render(q(
        None,
        false,
        Some("abc-defg-hij"),
        Some("abc-defg-hij")));
    assert_eq!(v.phase, RecordingPhase::Grace);
    assert!(!v.companion_should_capture);
}

#[test]
fn someone_elses_grace_window_is_not_reported_as_ours() {
    let v = render(q(
        None,
        false,
        Some("abc-defg-hij"),
        Some("zzz-yyyy-xxx")));
    assert_eq!(v.phase, RecordingPhase::Idle);
    assert_eq!(v.meeting_code, None);
}

/// The session outlives a microphone that will not open, so this message is
/// the only way the user learns the call is being captioned but not recorded.
#[test]
fn a_failed_microphone_reaches_the_meet_it_belongs_to() {
    let mut query = q(companion(Some("abc-defg-hij")), false, None, Some("abc-defg-hij"));
    query.audio_error = Some("no microphone".into());

    let view = render(query);

    assert_eq!(view.audio_error.as_deref(), Some("no microphone"));
    // Captions must keep flowing: losing audio is not losing the call.
    assert!(view.companion_should_capture);
}

/// A second Meet asking about its own call is not the one that failed.
#[test]
fn another_meet_is_not_told_about_it() {
    let mut query = q(companion(Some("abc-defg-hij")), false, None, Some("zzz-yyyy-xxx"));
    query.audio_error = Some("no microphone".into());

    assert_eq!(render(query).audio_error, None);
}

/// F5 in the Meet tab: pagehide paused the recorder and opened the countdown.
/// The reloaded tab must be told "grace", so it resumes by itself instead of
/// sitting on a pause it never asked for.
#[test]
fn a_leaving_pause_reads_as_grace_so_a_refreshed_tab_resumes() {
    let v = render(q_leaving(
        companion(Some("abc-defg-hij")),
        "abc-defg-hij",
        Some("abc-defg-hij"),
    ));
    assert_eq!(v.phase, RecordingPhase::Grace);
    assert_eq!(v.meeting_code.as_deref(), Some("abc-defg-hij"));
}

/// A pause the user asked for opens no countdown; nothing may resume it but
/// the user.
#[test]
fn a_user_pause_stays_paused() {
    let v = render(q(
        companion(Some("abc-defg-hij")),
        true,
        None,
        Some("abc-defg-hij"),
    ));
    assert_eq!(v.phase, RecordingPhase::Paused);
}

//! Tests for `active_session` — split out to keep that module under
//! the file-length gate.

use super::*;

/// These tests share one process-global session, and cargo runs them in
/// parallel — without this they clobber each other and fail at random.
static TEST_LOCK: Mutex<()> = Mutex::new(());

fn companion_for(code: &str) -> CompanionSession {
    CompanionSession {
        meeting_code: code.into(),
        session_id: format!("gmeet-{code}-1"),
        title: None,
    }
}

fn reset() -> std::sync::MutexGuard<'static, ()> {
    let guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    end();
    guard
}

#[test]
fn an_idle_app_admits_any_meet() {
    let _guard = reset();
    assert_eq!(admit_companion("abc-defg-hij"), Ok(()));
}

#[test]
fn a_local_recording_blocks_the_companion() {
    let _guard = reset();
    begin(TranscriptSource::Local);
    assert_eq!(
        admit_companion("abc-defg-hij"),
        Err(CompanionRefusal::AppIsRecording),
    );
}

/// The ingest server opens the session before the recorder is up. During that
/// window `/gmeet/state` must answer for the Meet, or the companion reads
/// "idle" and tears the capture down — the empty-transcript bug.
#[test]
fn an_admitted_start_is_a_session_already() {
    let _guard = reset();
    begin_companion_start(companion_for("abc-defg-hij"));

    let session = current().expect("admission opens the session");
    assert!(session.starting);
    assert_eq!(session.meeting_code(), Some("abc-defg-hij"));
    assert_eq!(session.source, TranscriptSource::Companion);
}

#[test]
fn the_recorder_coming_up_keeps_the_meet_and_clears_starting() {
    let _guard = reset();
    begin_companion_start(companion_for("abc-defg-hij"));

    begin(TranscriptSource::Companion);

    let session = current().unwrap();
    assert!(!session.starting);
    assert_eq!(session.meeting_code(), Some("abc-defg-hij"));
}

/// A launch that failed must not leave a ghost session behind — a ghost blocks
/// every later admit with "already recording" until the app restarts.
#[test]
fn a_failed_launch_is_abandoned() {
    let _guard = reset();
    begin_companion_start(companion_for("abc-defg-hij"));

    abandon_start();

    assert!(current().is_none());
    assert_eq!(admit_companion("zzz-yyyy-xxx"), Ok(()));
}

/// `abandon_start` is for launches only: a recorder that is actually up ends
/// through the stop path, whatever a late failure callback thinks.
#[test]
fn abandon_does_not_touch_a_running_recorder() {
    let _guard = reset();
    begin_companion_start(companion_for("abc-defg-hij"));
    begin(TranscriptSource::Companion);

    abandon_start();

    assert!(current().is_some());
}

#[test]
fn the_same_meet_is_readmitted_so_a_restarted_worker_can_rejoin() {
    let _guard = reset();
    begin_companion_start(companion_for("abc-defg-hij"));
    assert_eq!(admit_companion("abc-defg-hij"), Ok(()));
}

#[test]
fn a_second_meet_is_refused_by_name() {
    let _guard = reset();
    begin_companion_start(companion_for("abc-defg-hij"));
    assert_eq!(
        admit_companion("zzz-yyyy-xxx"),
        Err(CompanionRefusal::OtherMeeting {
            meeting_code: "abc-defg-hij".into()
        }),
    );
}

#[test]
fn attaching_with_nothing_running_does_not_invent_a_session() {
    let _guard = reset();
    attach_companion(companion_for("abc-defg-hij"));

    assert!(current().is_none(), "no recording, so no session to report");
}

#[test]
fn stopping_clears_the_session() {
    let _guard = reset();
    begin(TranscriptSource::Local);
    end();
    assert!(current().is_none());
    assert_eq!(admit_companion("abc-defg-hij"), Ok(()));
}

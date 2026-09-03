//! Shared builders for the state_view test modules.

use super::*;

/// Terse builder: the cases differ by one or two fields, and spelling the whole
/// struct out each time buried the difference under boilerplate.
pub(super) fn q<'a>(
    session: Option<ActiveSession>,
    paused: bool,
    grace: Option<&'a str>,
    asking: Option<&'a str>,
) -> Query<'a> {
    Query {
        session,
        paused,
        grace_code: grace.map(str::to_string),
        grace_window_code: None,
        asking_code: asking,
        elapsed_seconds: None,
        audio_error: None,
    }
}

/// Like `q`, with the five-minute countdown open for `window` (the user LEFT
/// that Meet rather than pausing it).
pub(super) fn q_leaving<'a>(
    session: Option<ActiveSession>,
    window: &str,
    asking: Option<&'a str>,
) -> Query<'a> {
    Query {
        grace_window_code: Some(window.to_string()),
        ..q(session, true, None, asking)
    }
}

pub(super) fn companion(code: Option<&str>) -> Option<ActiveSession> {
    Some(ActiveSession {
        source: TranscriptSource::Companion,
        companion: code.map(|code| crate::audio::active_session::CompanionSession {
            meeting_code: code.into(),
            session_id: format!("gmeet-{code}-1"),
            title: None,
        }),
        starting: false,
    })
}

/// A Meet the ingest server has admitted whose recorder is not up yet.
pub(super) fn starting(code: &str) -> Option<ActiveSession> {
    companion(Some(code)).map(|mut s| {
        s.starting = true;
        s
    })
}

pub(super) fn local() -> Option<ActiveSession> {
    Some(ActiveSession {
        source: TranscriptSource::Local,
        companion: None,
        starting: false,
    })
}

//! Why the running recording is capturing no audio, when it is not.
//!
//! Kept apart from `active_session` because it answers a different question:
//! that module says who owns the recording, this one says whether the
//! recording is whole. A companion session deliberately outlives a microphone
//! that will not open — Meet's captions still arrive, and a captioned call is
//! worth more than no call — which makes this message the only sign anything
//! is wrong, on both the app's screen and the companion's.

use std::sync::Mutex;

static AUDIO_ERROR: Mutex<Option<String>> = Mutex::new(None);

pub fn set(message: Option<String>) {
    *AUDIO_ERROR.lock().unwrap() = message;
}

pub fn current() -> Option<String> {
    AUDIO_ERROR.lock().unwrap().clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Shares one process-global with every other test in this module.
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn a_message_survives_until_it_is_cleared() {
        let _guard = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        set(None);

        set(Some("no microphone".into()));
        assert_eq!(current().as_deref(), Some("no microphone"));

        set(None);
        assert_eq!(current(), None);
    }
}

//! Decides how a recording session runs when transcription is unavailable.
//!
//! Recording is the product's core function and must not depend on a model
//! being present: a meeting can be captured now and transcribed later through
//! the existing retranscription path. Model validation therefore selects a
//! mode instead of refusing to start.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TranscriptionMode {
    /// A model is ready — transcribe while recording, as before.
    Live,
    /// No usable model — capture audio only.
    Off,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordingPolicy {
    pub mode: TranscriptionMode,
    pub auto_save: bool,
    /// True when `auto_save` was overridden for this session.
    pub auto_save_forced: bool,
    /// Why transcription is off, for the frontend notice. `None` when live.
    pub reason: Option<String>,
}

/// Where this session's transcript comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum TranscriptSource {
    /// Transcribe on this machine while recording.
    #[default]
    Local,
    /// Google Meet supplies the captions through the companion extension, so
    /// running an engine here would burn CPU to produce a second transcript
    /// nobody reads.
    Companion,
}

/// An audio-only session with auto-save disabled would produce nothing at all:
/// no transcript, because nothing transcribes here, and no audio, because the
/// saver discards chunks. That is silent total data loss, so auto-save is
/// forced on and the override is disclosed rather than applied quietly.
pub fn resolve(
    source: TranscriptSource,
    validation: Result<(), String>,
    auto_save: bool,
) -> RecordingPolicy {
    // Captions from Meet are a deliberate choice, not a failure: no engine, and
    // no "transcription unavailable" warning for the user to worry about.
    if source == TranscriptSource::Companion {
        return RecordingPolicy {
            mode: TranscriptionMode::Off,
            auto_save: true,
            auto_save_forced: !auto_save,
            reason: None,
        };
    }
    match validation {
        Ok(()) => RecordingPolicy {
            mode: TranscriptionMode::Live,
            auto_save,
            auto_save_forced: false,
            reason: None,
        },
        Err(reason) => RecordingPolicy {
            mode: TranscriptionMode::Off,
            auto_save: true,
            auto_save_forced: !auto_save,
            reason: Some(reason),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meet_captions_record_audio_only_without_calling_it_a_failure() {
        // A ready local model must not pull this session back into Live: the
        // whole point is to skip the engine when Meet already has the words.
        let policy = resolve(TranscriptSource::Companion, Ok(()), true);
        assert_eq!(policy.mode, TranscriptionMode::Off);
        assert!(policy.auto_save);
        assert!(!policy.auto_save_forced);
        assert_eq!(policy.reason, None, "this is a choice, not an error");
    }

    #[test]
    fn meet_captions_still_force_auto_save_so_the_audio_survives() {
        let policy = resolve(TranscriptSource::Companion, Ok(()), false);
        assert!(policy.auto_save);
        assert!(policy.auto_save_forced);
    }

    #[test]
    fn a_ready_model_records_live_and_respects_the_auto_save_preference() {
        let policy = resolve(TranscriptSource::Local, Ok(()), false);
        assert_eq!(policy.mode, TranscriptionMode::Live);
        assert!(!policy.auto_save);
        assert!(!policy.auto_save_forced);
        assert!(policy.reason.is_none());

        assert!(resolve(TranscriptSource::Local, Ok(()), true).auto_save);
    }

    #[test]
    fn a_missing_model_still_records_audio_only() {
        let policy = resolve(
            TranscriptSource::Local,
            Err("No Parakeet models are available".into()),
            true,
        );
        assert_eq!(policy.mode, TranscriptionMode::Off);
        assert!(policy.auto_save);
        assert!(!policy.auto_save_forced);
        assert_eq!(
            policy.reason.as_deref(),
            Some("No Parakeet models are available")
        );
    }

    #[test]
    fn auto_save_is_forced_on_when_there_is_nothing_else_to_keep() {
        let policy = resolve(TranscriptSource::Local, Err("model missing".into()), false);
        assert_eq!(policy.mode, TranscriptionMode::Off);
        assert!(
            policy.auto_save,
            "audio must be kept when there is no transcript"
        );
        assert!(policy.auto_save_forced, "the override must be disclosed");
    }
}

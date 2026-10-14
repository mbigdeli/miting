//! Run the `polyvoice` diarizer on 16 kHz mono samples. CPU-bound and
//! blocking: call from `spawn_blocking`, never from an async task directly.

use std::path::Path;

use super::cleanup::clean_turns;
use super::runner::{self, Runner};
use super::{sides, SpeakerTurn, TARGET_SAMPLE_RATE};
use crate::channels::Levels;

/// Longest recording we diarize in one pass. polyvoice defaults to one hour
/// to protect callers from foreign buffers; ours are our own recordings.
/// Measured on a 16-thread laptop: ~1.2 GB peak and ~20x realtime at 40 min.
pub const MAX_AUDIO_SECS: usize = 4 * 60 * 60;

/// Folder (under the app's models dir) where the ~9 MB speaker models live.
pub const MODELS_SUBDIR: &str = "speakers";

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("recording is too long for speaker identification ({0:.0} min, max 240)")]
    TooLong(f64),
    #[error("speaker models unavailable: {0}")]
    Models(String),
    #[error("speaker identification failed: {0}")]
    Run(String),
}

/// Diarize `samples` (16 kHz mono f32). Downloads the models into
/// `models_dir` on first use. Returns cleaned turns, numbered by first speech.
/// With the recording's channel `levels`, room and call voices never share
/// a speaker.
pub fn diarize(
    samples: &[f32],
    models_dir: &Path,
    levels: Option<&[Levels]>,
) -> Result<Vec<SpeakerTurn>, EngineError> {
    let secs = samples.len() as f64 / f64::from(TARGET_SAMPLE_RATE);
    if secs > MAX_AUDIO_SECS as f64 {
        return Err(EngineError::TooLong(secs / 60.0));
    }
    runner::limit_threads(runner::half_the_cores());
    let runner = Runner::load(models_dir, 1)?;
    let raw = runner.raw_turns(samples)?;
    log::info!("diarize: {:.0}s audio, {} turns", secs, raw.len());
    let raw = match levels {
        Some(levels) => sides::split_raw(&raw, levels),
        None => raw,
    };
    Ok(clean_turns(&raw))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_audio_over_the_cap_before_loading_models() {
        let too_long = vec![0.0_f32; (MAX_AUDIO_SECS + 1) * TARGET_SAMPLE_RATE as usize];
        let err = diarize(&too_long, Path::new("does-not-exist"), None).unwrap_err();
        assert!(matches!(err, EngineError::TooLong(_)));
    }

    /// Real-audio smoke test (downloads models). Run locally with
    /// `MITING_DIARIZE_WAV=path/to/16k_mono.wav cargo test diarize_real -- --ignored`.
    #[test]
    #[ignore = "needs a local 16 kHz wav and network for the first model download"]
    fn diarize_real_wav() {
        let path = std::env::var("MITING_DIARIZE_WAV").expect("set MITING_DIARIZE_WAV");
        let decoded = crate::audio::decoder::decode_audio_file(Path::new(&path)).unwrap();
        let samples = decoded.to_whisper_format();
        let dir = std::env::temp_dir().join("miting-diarize-test");
        let turns = diarize(&samples, &dir, None).unwrap();
        let speakers = super::super::cleanup::speaker_count(&turns);
        println!("{} turns, {} speakers", turns.len(), speakers);
        assert!(speakers >= 1);
    }
}

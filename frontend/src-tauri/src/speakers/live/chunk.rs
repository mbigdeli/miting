//! Diarize one stretch of one channel and give its speakers the identities
//! they already had in earlier stretches.

use crate::diarize_engine::engine::EngineError;
use crate::diarize_engine::runner::Runner;
use crate::diarize_engine::TARGET_SAMPLE_RATE;

use super::registry::{ChunkVoice, Registry};
use super::voiceprint::Voiceprints;

/// A turn with its known-voice number, in seconds from recording start.
pub type VoiceTurn = (f64, f64, usize);

/// Speech louder than this (dBFS over 100 ms) counts toward "worth diarizing".
const SPEECH_DB: f32 = -40.0;
/// A stretch with less speech than this is skipped outright.
const MIN_SPEECH_SECS: f64 = 2.0;

pub struct ChunkTools<'a> {
    pub runner: &'a Runner,
    pub prints: &'a Voiceprints,
}

/// Diarize `samples` (16 kHz, starting `offset` seconds into the recording)
/// and map its speakers through `registry`.
pub fn process(
    tools: &ChunkTools<'_>,
    registry: &mut Registry,
    samples: &[f32],
    offset: f64,
) -> Result<Vec<VoiceTurn>, EngineError> {
    if speech_secs(samples) < MIN_SPEECH_SECS {
        return Ok(Vec::new());
    }
    let raw = tools.runner.raw_turns(samples)?;
    let mut labels: Vec<&str> = Vec::new();
    let mut spans: Vec<Vec<(f64, f64)>> = Vec::new();
    for (start, end, label) in &raw {
        let i = match labels.iter().position(|l| l == label) {
            Some(i) => i,
            None => {
                labels.push(label);
                spans.push(Vec::new());
                labels.len() - 1
            }
        };
        spans[i].push((*start, *end));
    }
    let voices: Vec<ChunkVoice> = spans
        .iter()
        .map(|turns| ChunkVoice {
            print: tools.prints.print(samples, turns),
            secs: turns.iter().map(|(s, e)| (e - s).max(0.0)).sum(),
        })
        .collect();
    let ids = registry.assign(&voices);
    Ok(raw
        .iter()
        .map(|(start, end, label)| {
            let i = labels.iter().position(|l| l == label).unwrap_or(0);
            (start + offset, end + offset, ids[i])
        })
        .collect())
}

/// Seconds of 100 ms blocks louder than [`SPEECH_DB`].
#[must_use]
pub fn speech_secs(samples: &[f32]) -> f64 {
    let block = (TARGET_SAMPLE_RATE / 10) as usize;
    let loud = samples.chunks(block).filter(|b| db(b) >= SPEECH_DB).count();
    loud as f64 * 0.1
}

/// Mean-square level of `samples` in dBFS (-100 for silence).
#[must_use]
pub fn db(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return -100.0;
    }
    let ms = samples.iter().map(|x| x * x).sum::<f32>() / samples.len() as f32;
    if ms <= 0.0 {
        -100.0
    } else {
        (10.0 * ms.log10()).max(-100.0)
    }
}

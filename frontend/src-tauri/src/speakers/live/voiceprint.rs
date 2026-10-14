//! One voiceprint per chunk speaker: embed a few of their longest turns with
//! the diarizer's own speaker model and average. A handful of model calls per
//! speaker, small next to diarizing the chunk itself.

use std::path::Path;

use polyvoice::{Embedder, ResNet34Native};

use crate::diarize_engine::engine::EngineError;
use crate::diarize_engine::runner::registry;
use crate::diarize_engine::TARGET_SAMPLE_RATE;

/// The int8 ResNet34 the balanced profile embeds with.
const MODEL_ID: &str = "resnet34_int8";
/// Turns shorter than this make unreliable prints.
pub const MIN_TURN_SECS: f64 = 1.0;
/// Each embedded piece is at most this long...
const PIECE_SECS: f64 = 4.0;
/// ...and a speaker's print uses at most this much of their speech.
const BUDGET_SECS: f64 = 16.0;

pub struct Voiceprints {
    model: ResNet34Native,
}

impl Voiceprints {
    pub fn load(models_dir: &Path) -> Result<Self, EngineError> {
        let path = registry(models_dir)?
            .ensure(MODEL_ID)
            .map_err(|e| EngineError::Models(e.to_string()))?;
        let model =
            ResNet34Native::from_onnx_path(path).map_err(|e| EngineError::Models(e.to_string()))?;
        Ok(Self { model })
    }

    /// Mean unit-length print over the speaker's longest `turns` (seconds
    /// into `samples`). `None` when no turn is long enough.
    pub fn print(&self, samples: &[f32], turns: &[(f64, f64)]) -> Option<Vec<f32>> {
        let mut sum: Vec<f32> = Vec::new();
        for (start, end) in pieces(turns) {
            let piece = slice(samples, start, end);
            let Ok(mut e) = self.model.embed(piece) else {
                continue;
            };
            normalize(&mut e);
            if sum.is_empty() {
                sum = vec![0.0; e.len()];
            }
            let w = (end - start) as f32;
            sum.iter_mut().zip(&e).for_each(|(s, x)| *s += x * w);
        }
        if sum.is_empty() {
            return None;
        }
        normalize(&mut sum);
        Some(sum)
    }
}

/// Longest-first pieces of at most [`PIECE_SECS`], within [`BUDGET_SECS`].
#[must_use]
pub fn pieces(turns: &[(f64, f64)]) -> Vec<(f64, f64)> {
    let mut long: Vec<(f64, f64)> = turns
        .iter()
        .copied()
        .filter(|(s, e)| e - s >= MIN_TURN_SECS)
        .collect();
    long.sort_by(|a, b| (b.1 - b.0).total_cmp(&(a.1 - a.0)));
    let mut out = Vec::new();
    let mut used = 0.0;
    for (s, e) in long {
        if used >= BUDGET_SECS {
            break;
        }
        let end = e.min(s + PIECE_SECS).min(s + BUDGET_SECS - used);
        if end - s >= MIN_TURN_SECS {
            used += end - s;
            out.push((s, end));
        }
    }
    out
}

fn slice(samples: &[f32], start: f64, end: f64) -> &[f32] {
    let rate = f64::from(TARGET_SAMPLE_RATE);
    let a = ((start * rate) as usize).min(samples.len());
    let b = ((end * rate) as usize).clamp(a, samples.len());
    &samples[a..b]
}

fn normalize(v: &mut [f32]) {
    let n = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if n > 0.0 {
        v.iter_mut().for_each(|x| *x /= n);
    }
}

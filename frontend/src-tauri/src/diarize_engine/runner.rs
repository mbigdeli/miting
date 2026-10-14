//! A loaded `polyvoice` pipeline, reusable across many runs (live chunks load
//! the models once per recording, not once per chunk), and the knob that
//! caps how many CPU threads it may use.

use std::path::Path;

use polyvoice::models::ModelRegistry;
use polyvoice::types::{Profile, SampleRate};
use polyvoice::{Pipeline, PipelineConfig};

use super::cleanup::RawTurn;
use super::engine::{EngineError, MAX_AUDIO_SECS, MODELS_SUBDIR};
use super::TARGET_SAMPLE_RATE;

pub struct Runner {
    pipeline: Pipeline,
}

impl Runner {
    /// Build the pipeline, downloading the models into `models_dir` on first
    /// use. `pool` is the number of parallel embedder sessions.
    pub fn load(models_dir: &Path, pool: usize) -> Result<Self, EngineError> {
        let mut config = PipelineConfig::default();
        config.profile = Profile::Balanced;
        config.max_audio_samples = MAX_AUDIO_SECS * TARGET_SAMPLE_RATE as usize;
        config.embedder_pool_size = pool.max(1);
        let pipeline = Pipeline::builder()
            .config(config)
            .with_models_from(registry(models_dir)?)
            .build()
            .map_err(|e| EngineError::Models(e.to_string()))?;
        Ok(Self { pipeline })
    }

    /// Who spoke when in `samples` (16 kHz mono), with the engine's own
    /// labels. Times are seconds from the start of `samples`.
    pub fn raw_turns(&self, samples: &[f32]) -> Result<Vec<RawTurn>, EngineError> {
        let rate = SampleRate::new(TARGET_SAMPLE_RATE)
            .ok_or_else(|| EngineError::Run("invalid sample rate".into()))?;
        let result = self
            .pipeline
            .run(samples, rate)
            .map_err(|e| EngineError::Run(e.to_string()))?;
        Ok(result
            .turns
            .iter()
            .map(|t| (t.time.start, t.time.end, t.speaker.to_string()))
            .collect())
    }
}

/// The model registry rooted at the app's speaker-models folder.
pub fn registry(models_dir: &Path) -> Result<ModelRegistry, EngineError> {
    ModelRegistry::with_cache_dir(models_dir.join(MODELS_SUBDIR))
        .map_err(|e| EngineError::Models(e.to_string()))
}

/// Cap the CPU threads the next runs may use. polyvoice otherwise sizes its
/// pools to every core, which pins a 16-thread laptop for minutes. The knobs
/// are process-wide, so the last caller wins; runs do not overlap in practice
/// (live chunks during a recording, a full pass only after it).
pub fn limit_threads(threads: usize) {
    let threads = threads.max(1).to_string();
    std::env::set_var("POLYVOICE_EMBED_THREADS", &threads);
    std::env::set_var("POLYVOICE_INTRA_THREADS", &threads);
    std::env::set_var("POLYVOICE_CONV_THREADS", "1");
}

/// Half the logical cores: a full pass after the meeting stays quick
/// without making the machine unusable.
#[must_use]
pub fn half_the_cores() -> usize {
    std::thread::available_parallelism()
        .map(|n| (n.get() / 2).max(1))
        .unwrap_or(2)
}

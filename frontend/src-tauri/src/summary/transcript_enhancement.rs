//! Best-effort structured transcript cleanup after a recording is saved.

use std::path::PathBuf;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tracing::{info, warn};

use crate::summary::configured::generate_with_configured;
use crate::summary::transcript_enhancement_chunks::{parse_enhanced_response, segment_batches};

const SYSTEM_PROMPT: &str = r#"This is a meeting transcript. Improve any parts that contain transcription errors.

Use the context of the entire conversation to understand the intended words and rewrite unclear, broken, or unnatural phrases into fluent text. Keep the original language and meaning; do not translate or summarize.

The input is JSON. Return the same segments in the same order and keep their index and timing fields unchanged. Edit the text fields as freely as needed to produce the best corrected transcript. Return only the JSON."#;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub(crate) struct EnhancementSegment {
    pub index: usize,
    pub text: String,
    pub timestamp: String,
    pub audio_start_time: Option<f64>,
    pub audio_end_time: Option<f64>,
    pub duration: Option<f64>,
}

#[derive(Serialize)]
struct SegmentPayload<'a> {
    segments: &'a [EnhancementSegment],
}

pub(crate) async fn enhance_saved_transcript(
    pool: &SqlitePool,
    app_data_dir: Option<&PathBuf>,
    meeting_id: &str,
    segments: &[EnhancementSegment],
) -> Result<Option<Vec<String>>, String> {
    if segments.is_empty() {
        return Ok(None);
    }

    let started = Instant::now();
    let input_chars: usize = segments.iter().map(|s| s.text.chars().count()).sum();
    let batches = segment_batches(segments);
    info!(
        "Transcript enhancement started: meeting_id={}, segments={}, chars={}, batches={}",
        meeting_id,
        segments.len(),
        input_chars,
        batches.len()
    );

    let mut texts = Vec::with_capacity(segments.len());
    for (index, batch) in batches.iter().enumerate() {
        let batch_started = Instant::now();
        let batch_chars: usize = batch.iter().map(|s| s.text.chars().count()).sum();
        let prompt = serde_json::to_string(&SegmentPayload { segments: batch })
            .map_err(|e| format!("serialize transcript enhancement input: {e}"))?;
        info!(
            "Transcript enhancement request: meeting_id={}, batch={}/{}, segments={}, chars={}, payload_bytes={}",
            meeting_id,
            index + 1,
            batches.len(),
            batch.len(),
            batch_chars,
            prompt.len()
        );
        let raw = match generate_with_configured(pool, app_data_dir, SYSTEM_PROMPT, &prompt).await {
            Ok(value) => value,
            Err(error) if error == "no_ai_configured" => {
                info!("Transcript enhancement skipped: no configured AI");
                return Ok(None);
            }
            Err(error) => {
                warn!(
                    "Transcript enhancement request failed: meeting_id={}, batch={}/{}, elapsed_ms={}, error={}",
                    meeting_id,
                    index + 1,
                    batches.len(),
                    batch_started.elapsed().as_millis(),
                    error
                );
                return Err(error);
            }
        };
        info!(
            "Transcript enhancement response: meeting_id={}, batch={}/{}, response_bytes={}, elapsed_ms={}",
            meeting_id,
            index + 1,
            batches.len(),
            raw.len(),
            batch_started.elapsed().as_millis()
        );
        texts.extend(parse_enhanced_response(batch, &raw)?);
    }

    info!(
        "Transcript enhancement accepted: meeting_id={}, segments={}, elapsed_ms={}",
        meeting_id,
        texts.len(),
        started.elapsed().as_millis()
    );
    Ok(Some(texts))
}

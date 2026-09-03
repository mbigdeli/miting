//! Every model-status variant must survive serialization.
//!
//! These enums cross the Tauri boundary inside a `Vec`, so one unserializable
//! variant does not degrade a single row — it fails the whole command, and the
//! settings UI shows "Failed to load models" with no way back. The summary
//! enum hit exactly that: `#[serde(tag = "type")]` cannot encode a newtype
//! variant wrapping a string, and the failure only appears once a download
//! errors, long after any compile check.

use crate::parakeet_engine::parakeet_engine::ModelStatus as ParakeetStatus;
use crate::shenava_engine::catalog::ModelStatus as ShenavaStatus;
use crate::summary::summary_engine::model_manager::ModelStatus as SummaryStatus;
use crate::whisper_engine::whisper_engine::ModelStatus as WhisperStatus;

fn assert_serializes<T: serde::Serialize + std::fmt::Debug>(label: &str, value: T) {
    serde_json::to_value(&value)
        .unwrap_or_else(|e| panic!("{label} failed to serialize: {e} ({value:?})"));
}

#[test]
fn summary_model_status_variants_all_serialize() {
    assert_serializes("summary/not_downloaded", SummaryStatus::NotDownloaded);
    assert_serializes("summary/downloading", SummaryStatus::Downloading { progress: 42 });
    assert_serializes("summary/available", SummaryStatus::Available);
    assert_serializes(
        "summary/corrupted",
        SummaryStatus::Corrupted {
            file_size: 107,
            expected_min_size: 917,
        },
    );
    assert_serializes(
        "summary/error",
        SummaryStatus::Error {
            message: "Download timeout".to_string(),
        },
    );
}

#[test]
fn summary_error_status_keeps_the_tagged_shape_the_ui_reads() {
    let value = serde_json::to_value(SummaryStatus::Error {
        message: "Validation failed".to_string(),
    })
    .expect("error status must serialize");

    assert_eq!(value["type"], "error");
    assert_eq!(value["message"], "Validation failed");
}

#[test]
fn transcription_engine_status_variants_all_serialize() {
    assert_serializes("whisper/error", WhisperStatus::Error("boom".to_string()));
    assert_serializes("whisper/downloading", WhisperStatus::Downloading { progress: 5 });
    assert_serializes("whisper/available", WhisperStatus::Available);
    assert_serializes("whisper/missing", WhisperStatus::Missing);
    assert_serializes(
        "whisper/corrupted",
        WhisperStatus::Corrupted {
            file_size: 1,
            expected_min_size: 2,
        },
    );

    assert_serializes("parakeet/error", ParakeetStatus::Error("boom".to_string()));
    assert_serializes("parakeet/available", ParakeetStatus::Available);
    assert_serializes("parakeet/missing", ParakeetStatus::Missing);

    assert_serializes("shenava/error", ShenavaStatus::Error("boom".to_string()));
    assert_serializes("shenava/available", ShenavaStatus::Available);
    assert_serializes("shenava/missing", ShenavaStatus::Missing);
}

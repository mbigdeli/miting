//! Speaker identification for meetings without Google Meet captions: local
//! acoustic diarization (`diarize_engine`), AI name suggestions from the
//! transcript, and user renames. Doc 18.

pub mod commands;
pub mod job;
pub mod live;
pub mod naming;
pub mod prompt;
pub mod review;
pub mod source;
pub mod suggest;
pub mod voices;

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

/// Event the meeting page listens to for progress and completion.
pub const STATUS_EVENT: &str = "speakers-status";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Stage {
    /// Reading the recording and separating voices.
    Listening,
    /// Asking the configured AI for names found in the transcript.
    Naming,
    Done,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct Status {
    pub meeting_id: String,
    pub stage: Stage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

fn running() -> &'static Mutex<HashMap<String, Stage>> {
    static RUNNING: OnceLock<Mutex<HashMap<String, Stage>>> = OnceLock::new();
    RUNNING.get_or_init(Default::default)
}

/// Stage of an identification in progress for `meeting_id`, if any.
#[must_use]
pub fn current_stage(meeting_id: &str) -> Option<Stage> {
    running().lock().ok()?.get(meeting_id).copied()
}

/// Claim `meeting_id` for a run. False when one is already in progress.
fn claim(meeting_id: &str) -> bool {
    let Ok(mut map) = running().lock() else {
        return false;
    };
    if map.contains_key(meeting_id) {
        return false;
    }
    map.insert(meeting_id.to_string(), Stage::Listening);
    true
}

/// Record and broadcast a stage. Terminal stages release the claim.
fn report<R: Runtime>(app: &AppHandle<R>, meeting_id: &str, stage: Stage, message: Option<String>) {
    if let Ok(mut map) = running().lock() {
        if matches!(stage, Stage::Done | Stage::Failed) {
            map.remove(meeting_id);
        } else {
            map.insert(meeting_id.to_string(), stage);
        }
    }
    let status = Status {
        meeting_id: meeting_id.to_string(),
        stage,
        message,
    };
    if let Err(e) = app.emit(STATUS_EVENT, status) {
        log::warn!("speakers: status event not sent: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_meeting_runs_once_at_a_time() {
        assert!(claim("m-claim"));
        assert!(!claim("m-claim"));
        assert_eq!(current_stage("m-claim"), Some(Stage::Listening));
        running().lock().unwrap().remove("m-claim");
        assert!(claim("m-claim"));
        running().lock().unwrap().remove("m-claim");
    }
}

#[cfg(test)]
#[path = "job_real_tests.rs"]
mod job_real_tests;

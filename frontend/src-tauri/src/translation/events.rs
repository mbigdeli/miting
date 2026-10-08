//! Events the frontend listens to. Translations travel on their own event
//! because the transcript listener drops repeated `sequence_id`s.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

pub const LINE: &str = "transcript-translation";
pub const LIVE_STATUS: &str = "translation-live-status";
pub const PROGRESS: &str = "translation-progress";

/// One live line translated.
#[derive(Debug, Clone, Serialize)]
pub struct LineTranslated {
    pub sequence_id: u64,
    pub language: String,
    pub text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum LiveState {
    #[default]
    Off,
    Preparing,
    Running,
    Error,
}

/// State of live translation for the current recording.
#[derive(Debug, Clone, Serialize, Default)]
pub struct LiveStatus {
    pub state: LiveState,
    pub language: Option<String>,
    /// Display name of the AI doing the work (never the model).
    pub provider: Option<String>,
    pub backlog_total: usize,
    pub backlog_done: usize,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum JobState {
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Progress of translating a saved miting into one language.
#[derive(Debug, Clone, Serialize)]
pub struct JobProgress {
    pub meeting_id: String,
    pub language: String,
    pub done: usize,
    pub total: usize,
    pub state: JobState,
    pub error: Option<String>,
}

pub fn emit<R: Runtime, T: Serialize + Clone>(app: &AppHandle<R>, name: &str, payload: &T) {
    if let Err(e) = app.emit(name, payload.clone()) {
        log::warn!("emit {name} failed: {e}");
    }
}

/// Where live translation reports: the app (as events) or a test double.
pub trait Notify: Clone + Send + Sync + 'static {
    fn line(&self, line: &LineTranslated);
    fn status(&self, status: &LiveStatus);
    fn progress(&self, progress: &JobProgress);
}

impl<R: Runtime> Notify for AppHandle<R> {
    fn line(&self, line: &LineTranslated) {
        emit(self, LINE, line);
    }

    fn status(&self, status: &LiveStatus) {
        emit(self, LIVE_STATUS, status);
    }

    fn progress(&self, progress: &JobProgress) {
        emit(self, PROGRESS, progress);
    }
}

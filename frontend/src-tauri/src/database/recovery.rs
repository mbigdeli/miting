//! Outcome of startup database initialization.
//!
//! Startup used to `.expect()` on this result, so a broken migration checksum
//! or a locked file killed the process before the window ever painted. The
//! outcome is recorded here instead, the window opens either way, and the
//! frontend renders a recovery screen when it reads `Failed`.

use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum DbInitOutcome {
    /// Startup has not finished writing an outcome yet.
    Pending,
    /// No database file existed; onboarding owns creating one.
    FirstLaunch,
    Ready,
    Failed {
        error: String,
    },
}

/// Managed unconditionally in the builder, so the status command answers even
/// when every other piece of app state is missing.
pub struct DbInitState(pub Mutex<DbInitOutcome>);

impl Default for DbInitState {
    fn default() -> Self {
        DbInitState(Mutex::new(DbInitOutcome::Pending))
    }
}

pub fn set_outcome(app: &AppHandle, outcome: DbInitOutcome) {
    match app.try_state::<DbInitState>() {
        Some(state) => match state.0.lock() {
            Ok(mut current) => *current = outcome,
            Err(e) => log::error!("db init state poisoned: {e}"),
        },
        None => log::error!("DbInitState not managed; cannot record {outcome:?}"),
    }
}

pub fn current_outcome(app: &AppHandle) -> DbInitOutcome {
    app.try_state::<DbInitState>()
        .and_then(|state| state.0.lock().ok().map(|current| current.clone()))
        .unwrap_or(DbInitOutcome::Pending)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn outcome_serializes_every_variant_for_the_frontend() {
        let cases = [
            (DbInitOutcome::Pending, "pending"),
            (DbInitOutcome::FirstLaunch, "firstLaunch"),
            (DbInitOutcome::Ready, "ready"),
            (
                DbInitOutcome::Failed {
                    error: "migration 20250916100000 was modified".into(),
                },
                "failed",
            ),
        ];
        for (outcome, expected_state) in cases {
            let value = serde_json::to_value(&outcome).expect("outcome must serialize");
            assert_eq!(value["state"], expected_state);
        }
    }

    #[test]
    fn failed_outcome_carries_the_error_text() {
        let value = serde_json::to_value(DbInitOutcome::Failed {
            error: "database is locked".into(),
        })
        .unwrap();
        assert_eq!(value["error"], "database is locked");
    }
}

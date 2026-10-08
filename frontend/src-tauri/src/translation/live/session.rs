//! Runs one live session once its lines are wired up: choose the model, then
//! the live worker and the background pass side by side until both finish.

use std::path::PathBuf;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio_util::sync::CancellationToken;

use super::state::{self, Session};
use super::{backlog, worker, Ctx};
use crate::translation::engine::Translator;
use crate::translation::events::{LiveState, LiveStatus, Notify};
use crate::translation::provider::ResolvedProvider;
use crate::translation::{picker, system_prompt_for, workdir};

/// Everything a session needs, gathered by `start` (or a test).
pub(super) struct Launch {
    pub rp: ResolvedProvider,
    pub dir: PathBuf,
    pub pool: Option<SqlitePool>,
    pub language: String,
    /// New lines as they are spoken.
    pub rx: UnboundedReceiver<(u64, String)>,
    pub first_live: Arc<AtomicU64>,
    /// Lines spoken before translation was turned on.
    pub earlier: Vec<(u64, String)>,
    /// Stops the line listeners.
    pub close: Box<dyn FnOnce() + Send>,
}

pub(super) fn begin<N: Notify>(n: N, l: Launch) -> LiveStatus {
    let cancel = CancellationToken::new();
    let status = LiveStatus {
        state: LiveState::Preparing,
        language: Some(l.language.clone()),
        provider: Some(l.rp.label()),
        ..LiveStatus::default()
    };
    let id = state::install(&n, Session::new(cancel.clone(), l.close), status.clone());
    let (rp, dir, language) = (l.rp, l.dir, l.language);
    let ctx = Ctx {
        id,
        language: language.clone(),
        pool: l.pool,
        cancel,
        first_live: l.first_live,
    };
    let (rx, earlier) = (l.rx, l.earlier);
    tauri::async_runtime::spawn(async move {
        let model = picker::choose(&rp, &dir, &ctx.cancel).await;
        if ctx.cancel.is_cancelled() {
            state::finish(&n, id);
            return;
        }
        let system = system_prompt_for(&language);
        let make = |name: &str| {
            Arc::new(Translator::new(
                rp.clone(),
                model.clone(),
                system.clone(),
                workdir(&dir, name),
            ))
        };
        state::update(&n, id, |s| s.state = LiveState::Running);
        let back = tauri::async_runtime::spawn(backlog::run(
            n.clone(),
            ctx.clone(),
            make("backlog"),
            earlier,
        ));
        worker::run(n.clone(), ctx, make("live"), rx).await;
        let _ = back.await;
        state::finish(&n, id);
    });
    status
}

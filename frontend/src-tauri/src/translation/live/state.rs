//! The single live session and its status. Updates carry their session id so
//! a stopped session never overwrites the status of its replacement.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;

use tokio_util::sync::CancellationToken;

use crate::translation::events::{LiveState, LiveStatus, Notify};

/// A running session: its cancel switch and how to stop listening for lines.
pub(super) struct Session {
    cancel: CancellationToken,
    close: Option<Box<dyn FnOnce() + Send>>,
}

impl Session {
    pub(super) fn new(cancel: CancellationToken, close: Box<dyn FnOnce() + Send>) -> Self {
        Self {
            cancel,
            close: Some(close),
        }
    }

    fn close(&mut self) {
        if let Some(close) = self.close.take() {
            close();
        }
    }
}

static SESSION: Mutex<Option<(u64, Session)>> = Mutex::new(None);
static STATUS: Mutex<Option<LiveStatus>> = Mutex::new(None);
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
/// Bumped by every stop, so a start still gathering its inputs can tell it
/// was turned off (or replaced) in the meantime.
static STOPS: AtomicU64 = AtomicU64::new(0);
/// A live batch is in flight (the backlog waits for it on local models).
pub(super) static LIVE_BUSY: AtomicBool = AtomicBool::new(false);

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|p| p.into_inner())
}

pub(super) fn stops() -> u64 {
    STOPS.load(Ordering::SeqCst)
}

pub fn current_status() -> LiveStatus {
    lock(&STATUS).clone().unwrap_or_default()
}

fn publish<N: Notify>(n: &N, status: LiveStatus) {
    *lock(&STATUS) = Some(status.clone());
    n.status(&status);
}

pub(super) fn install<N: Notify>(n: &N, session: Session, status: LiveStatus) -> u64 {
    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    let replaced = lock(&SESSION).replace((id, session));
    if let Some((_, mut old)) = replaced {
        old.cancel.cancel();
        old.close();
    }
    publish(n, status);
    id
}

/// Change the status of session `id`, if it is still the current one.
pub(super) fn update<N: Notify>(n: &N, id: u64, f: impl FnOnce(&mut LiveStatus)) {
    // Hold the session lock so a stop or a new start cannot slip in between.
    let guard = lock(&SESSION);
    if guard.as_ref().map(|(current, _)| *current) != Some(id) {
        return;
    }
    let mut status = current_status();
    f(&mut status);
    publish(n, status);
    drop(guard);
}

/// Turn live translation off now; queued work is abandoned.
pub fn stop<N: Notify>(n: &N) {
    STOPS.fetch_add(1, Ordering::SeqCst);
    if let Some((_, mut session)) = lock(&SESSION).take() {
        session.cancel.cancel();
        session.close();
    }
    publish(n, LiveStatus::default()); // also clears a finished session's error
}

/// The recording stopped: accept no new lines, let queued ones finish.
pub(super) fn close_intake() {
    if let Some((_, session)) = lock(&SESSION).as_mut() {
        session.close();
    }
}

/// All work of session `id` is done.
pub(super) fn finish<N: Notify>(n: &N, id: u64) {
    let finished = {
        let mut guard = lock(&SESSION);
        match guard.as_ref() {
            Some((current, _)) if *current == id => guard.take(),
            _ => None,
        }
    };
    if let Some((_, mut session)) = finished {
        session.close();
        let mut status = current_status();
        if status.state != LiveState::Error {
            status = LiveStatus::default();
        }
        publish(n, status);
    }
}

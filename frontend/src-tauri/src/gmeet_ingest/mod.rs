//! Google Meet ingest server (Miting addition).
//!
//! A small localhost HTTP server the companion Chrome extension talks to. The
//! extension scrapes Google Meet's live captions (which already carry accurate
//! speaker *names*), the participant roster, and meeting metadata, and POSTs
//! them here. Captions are written straight into miting's `transcripts` table
//! with `speaker` = the real participant name — so a Google Meet ends up as a
//! fully name-attributed transcript with no audio/whisper/diarization guesswork.
//! On session end we kick off miting's normal summary pipeline (Codex, etc.).
//!
//! Security: binds to 127.0.0.1 only and requires `Authorization: Bearer <token>`
//! on every data endpoint. The token is generated once, stored under the app
//! data dir, and shown in Settings for one-time pairing with the extension.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::state::AppState;

pub mod caption_dedup;
pub mod diarize;
pub mod grace;
pub mod native_host;
pub mod state_view;

/// Fixed localhost port (already whitelisted in the app's CSP connect-src).
pub const GMEET_INGEST_PORT: u16 = 5167;

struct IngestState<R: Runtime> {
    app: AppHandle<R>,
    token: Arc<String>,
}

// Manual Clone: deriving would wrongly require `R: Clone` (Runtime marker types
// aren't Clone), but AppHandle<R> is always Clone. axum's State needs this.
impl<R: Runtime> Clone for IngestState<R> {
    fn clone(&self) -> Self {
        Self {
            app: self.app.clone(),
            token: self.token.clone(),
        }
    }
}

// ---- resumability (single source of truth) -------------------------------
//
// Miting — not the extension — owns whether a just-left Google Meet can still
// be resumed into the same session. A session becomes resumable when it pauses
// (Meet closed within the grace window) and stops being resumable the moment it
// is started/resumed again or finalized ("Stop & summarize now" or grace
// expiry). The extension asks via GET /gmeet/session/resume-check before it
// starts, so there is no independent extension timer to drift out of sync with
// the frontend grace countdown (the desync-bug family this replaces).
//
// Shared between the ingest server handlers and the `gmeet_clear_resumable`
// Tauri command through Tauri managed state.

/// Resumability state, keyed by Google Meet code.
#[derive(Default)]
pub struct GmeetResumeState {
    inner: Mutex<ResumeInner>,
}

#[derive(Default)]
struct ResumeInner {
    /// meeting_code -> resumable session_id (present only while paused).
    resumable: HashMap<String, String>,
    /// meeting_code -> actively-recording session_id (until pause/finalize).
    /// Lets a restarted extension re-adopt the live session instead of forking
    /// a second one (which orphaned its captions — the captions=0 bug).
    active: HashMap<String, String>,
    /// session_id -> meeting_code (so a finalize-by-session-id can find the code).
    session_code: HashMap<String, String>,
}

impl GmeetResumeState {
    /// A session started (fresh) or resumed: remember its code, and it is no
    /// longer a pending-resume candidate while it is actively recording.
    fn on_start(&self, session_id: &str, meeting_code: &str) {
        let mut g = self.inner.lock().expect("gmeet resume state poisoned");
        g.session_code
            .insert(session_id.to_string(), meeting_code.to_string());
        g.resumable.remove(meeting_code);
        g.active
            .insert(meeting_code.to_string(), session_id.to_string());
    }

    /// A session paused: it can be resumed by the same meeting code until it is
    /// resumed or finalized.
    fn on_pause(&self, session_id: &str) {
        let mut g = self.inner.lock().expect("gmeet resume state poisoned");
        if let Some(code) = g.session_code.get(session_id).cloned() {
            if g.active.get(&code).map(String::as_str) == Some(session_id) {
                g.active.remove(&code);
            }
            g.resumable.insert(code, session_id.to_string());
        }
    }

    /// The resumable session id for a meeting code, if any (paused sessions
    /// only — this is the GET /resume-check contract the extension polls).
    fn resume_check(&self, meeting_code: &str) -> Option<String> {
        self.inner
            .lock()
            .expect("gmeet resume state poisoned")
            .resumable
            .get(meeting_code)
            .cloned()
    }

    /// The reusable session id for a meeting code: a paused session in its
    /// grace window, or the actively-recording one. Used by session_start to
    /// re-adopt a live session when a restarted extension lost its id.
    fn reusable(&self, meeting_code: &str) -> Option<String> {
        let g = self.inner.lock().expect("gmeet resume state poisoned");
        g.resumable
            .get(meeting_code)
            .or_else(|| g.active.get(meeting_code))
            .cloned()
    }

    /// A session was finalized: forget its code mapping and drop its resumable
    /// entry — but only if that entry still points at *this* session (a newer
    /// session for the same code may have replaced it).
    fn clear(&self, session_id: &str) {
        let mut g = self.inner.lock().expect("gmeet resume state poisoned");
        if let Some(code) = g.session_code.remove(session_id) {
            if g.resumable.get(&code).map(String::as_str) == Some(session_id) {
                g.resumable.remove(&code);
            }
            if g.active.get(&code).map(String::as_str) == Some(session_id) {
                g.active.remove(&code);
            }
        }
    }
}

// ---- pairing token -------------------------------------------------------

fn token_path<R: Runtime>(app: &AppHandle<R>) -> Option<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("gmeet_pairing_token.txt"))
}

/// Load the pairing token, generating and persisting one on first run.
pub fn load_or_create_token<R: Runtime>(app: &AppHandle<R>) -> String {
    if let Some(path) = token_path(app) {
        if let Ok(existing) = std::fs::read_to_string(&path) {
            let trimmed = existing.trim().to_string();
            if !trimmed.is_empty() {
                return trimmed;
            }
        }
        let token = generate_token();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(&path, &token);
        return token;
    }
    generate_token()
}

fn generate_token() -> String {
    // 32 hex chars from a v4 UUID (no extra deps; uuid is already a dependency).
    let a = uuid::Uuid::new_v4().simple().to_string();
    let b = uuid::Uuid::new_v4().simple().to_string();
    format!("{a}{b}")
}

fn authed<R: Runtime>(headers: &HeaderMap, st: &IngestState<R>) -> bool {
    headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|t| t == st.token.as_str())
        .unwrap_or(false)
}

// ---- request/response payloads ------------------------------------------

#[derive(Deserialize)]
struct SessionStartReq {
    /// Google Meet code (e.g. "abc-defg-hij"); used to resume same-meeting joins.
    meeting_code: Option<String>,
    /// The Meet's URL, kept so the saved meeting can link back to the call.
    #[serde(default)]
    meeting_url: Option<String>,
    title: Option<String>,
    #[serde(default)]
    participants: Vec<String>,
    /// Extension-owned gmeet session id (kept stable across pause/resume so
    /// captions + diarization stay unified). Backend mints one only if absent.
    session_id: Option<String>,
    /// True when the extension is resuming a recently-paused session (same Meet
    /// rejoined within the grace window).
    #[serde(default)]
    resume: bool,
}

#[derive(Serialize)]
struct SessionStartResp {
    /// The gmeet session id (returned in the `meeting_id` field for extension
    /// compatibility — it is the key the extension echoes on later calls).
    meeting_id: String,
    resumed: bool,
    /// False when the app declined to record this Meet; `reason` says why.
    /// Sent as 200 rather than a 4xx so older builds of the extension, which
    /// only parse the body, do not treat it as a transport failure.
    #[serde(default = "default_true")]
    admitted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    /// Where caption block numbering continues for this session. The tracker
    /// in the content script restarts at 1 on every fresh DOM, so a rejoin
    /// that seeded from 1 would upsert over the session's own earlier rows.
    #[serde(skip_serializing_if = "Option::is_none")]
    next_block_seq: Option<i64>,
}

fn default_true() -> bool {
    true
}

impl SessionStartResp {
    fn refused(reason: String) -> Self {
        Self {
            meeting_id: String::new(),
            resumed: false,
            admitted: false,
            reason: Some(reason),
            next_block_seq: None,
        }
    }
}

#[derive(Deserialize)]
struct CaptionItem {
    speaker: Option<String>,
    text: String,
    /// Milliseconds from meeting start (optional; used for ordering + overlap).
    ts_ms: Option<i64>,
    /// The Meet caption block this frame belongs to, numbered per session by
    /// the extension. Present -> exact row addressing; absent (old extension)
    /// -> the legacy text-similarity fallback below.
    #[serde(default)]
    block_seq: Option<i64>,
}

#[derive(Deserialize)]
struct CaptionsReq {
    meeting_id: String,
    #[serde(default)]
    captions: Vec<CaptionItem>,
}

#[derive(Deserialize)]
struct ParticipantsReq {
    meeting_id: String,
    #[serde(default)]
    participants: Vec<String>,
}

#[derive(Deserialize)]
struct SessionEndReq {
    meeting_id: String,
}

#[derive(Deserialize)]
struct SessionPauseReq {
    /// True when the user pressed pause, as opposed to leaving the Meet.
    #[serde(default)]
    user_requested: Option<bool>,
    meeting_id: String,
}

#[derive(Deserialize)]
struct ResumeCheckQuery {
    meeting_code: Option<String>,
}

#[derive(Serialize)]
struct ResumeCheckResp {
    resumable: bool,
    session_id: Option<String>,
}

// ---- handlers ------------------------------------------------------------

/// Health, plus what the app is recording right now.
///
/// The app cannot push to the extension — Chrome only lets the extension open
/// the channel — so the companion polls this to notice a recording the *app*
/// stopped or paused. Without it, stopping from Miting left the Meet toolbar
/// showing a recording that no longer existed.
/// Deliberately answers without a token so the companion can tell "Miting is
/// not running" from "Miting is running but we are not paired with it" — but it
/// reports which of those it is. Answering a bare `ok: true` to an unpaired
/// caller is why the popup said "Desktop app connected" while every real
/// request came back 401 and recording could not start.
async fn health<R: Runtime>(
    State(st): State<IngestState<R>>,
    headers: HeaderMap,
) -> Json<Value> {
    let session = crate::audio::active_session::current();
    let paused = crate::audio::recording_commands::is_recording_paused().await;
    let authorized = authed(&headers, &st);
    Json(json!({
        "ok": true,
        "authorized": authorized,
        "service": "miting gmeet ingest",
        "version": env!("CARGO_PKG_VERSION"),
        "recording": {
            "active": session.is_some(),
            "paused": paused,
            "companion": session
                .as_ref()
                .map(|s| s.source == crate::audio::recording_policy::TranscriptSource::Companion)
                .unwrap_or(false),
            "meeting_code": session.and_then(|s| s.meeting_code().map(str::to_string)),
        },
    }))
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn pool_from<R: Runtime>(st: &IngestState<R>) -> Result<SqlitePool, StatusCode> {
    st.app
        .try_state::<AppState>()
        .map(|s| s.db_manager.pool().clone())
        .ok_or(StatusCode::SERVICE_UNAVAILABLE)
}

/// A write or lifecycle call is honored only for the session the app is
/// actually running — recording, paused in grace, or admitted and launching
/// (including a handover still waiting for the old recorder). Anything else
/// is a stale tab or an already-finalized session: acting on those is how a
/// background Meet tab paused the live recording, how a second session_end
/// double-finalized, and how captions crossed between meetings.
fn session_is_current(sid: &str) -> bool {
    if crate::audio::active_session::current()
        .and_then(|s| s.companion)
        .is_some_and(|c| c.session_id == sid)
    {
        return true;
    }
    PENDING_HANDOVER
        .lock()
        .unwrap()
        .as_ref()
        .is_some_and(|(_, id)| id == sid)
}

/// Where caption numbering continues for a session: one past its highest
/// stored block. A fresh session gets 1; a rejoin gets MAX+1, so blocks from
/// the new DOM never upsert over rows the same session already wrote. `None`
/// only when the database is unreachable — the extension then keeps its
/// local counter, which is correct for every case except a mid-session
/// content-script restart.
async fn next_block_seq_for<R: Runtime>(st: &IngestState<R>, session_id: &str) -> Option<i64> {
    let pool = pool_from(st).ok()?;
    sqlx::query_scalar::<_, i64>(
        "SELECT COALESCE(MAX(block_seq), 0) + 1 FROM gmeet_captions WHERE gmeet_session_id = ?",
    )
    .bind(session_id)
    .fetch_one(&pool)
    .await
    .ok()
}

/// Open the session and launch the recorder for an admitted Meet, then tell
/// the webview to bring the record screen forward. The one entry point for a
/// companion recording — the normal start and the grace handover both end
/// here, so they cannot drift apart.
fn spawn_companion_launch<R: Runtime>(
    app: &tauri::AppHandle<R>,
    code: &str,
    title: &str,
    gmeet_session_id: &str,
    resume: bool,
) {
    grace::cancel(app);
    grace::mark_seen();
    crate::audio::active_session::begin_companion_start(
        crate::audio::active_session::CompanionSession {
            meeting_code: code.to_string(),
            session_id: gmeet_session_id.to_string(),
            title: Some(title.to_string()),
        },
    );
    {
        let app = app.clone();
        let launch_title = title.to_string();
        let launch_code = code.to_string();
        tauri::async_runtime::spawn(async move {
            match crate::audio::recording_commands::start_recording_with_meeting_name(
                app.clone(),
                Some(launch_title),
                crate::audio::recording_policy::TranscriptSource::Companion,
            )
            .await
            {
                Ok(()) => {
                    log::info!("gmeet ingest: recorder up for {launch_code}");
                }
                // The recorder refusing because it is already running for this
                // very Meet is a rejoin, not a failure.
                Err(e) if e.contains("already in progress") => {
                    log::info!("gmeet ingest: recorder already running for {launch_code}");
                    crate::audio::active_session::begin(
                        crate::audio::recording_policy::TranscriptSource::Companion,
                    );
                }
                Err(e) => {
                    // No recorder ever came up: clear the starting session so
                    // the app is not stuck "recording" a ghost, and say why.
                    log::error!("gmeet ingest: recorder failed for {launch_code}: {e}");
                    crate::audio::active_session::abandon_start();
                    let _ = app.emit(
                        "recording-error",
                        format!("Recording could not start for this Meet: {e}"),
                    );
                }
            }
        });
    }
    let _ = app.emit(
        "gmeet-start-recording",
        json!({
            "gmeet_session_id": gmeet_session_id,
            "title": title,
            "meeting_code": code,
            "resume": resume,
        }),
    );
}

/// A Meet in its grace window hands over to a NEW Meet instead of blocking it.
///
/// Closing a Meet pauses the recorder for five minutes so a rejoin can resume.
/// Starting a DIFFERENT Meet inside that window used to be refused with
/// "already recording another Meet" — the user, mid-back-to-back calls, could
/// not record the second one at all. The refusal is only right while the old
/// recording is genuinely live; paused-in-grace means "waiting to be
/// finalized", and a new Meet is exactly the signal to finalize it.
fn handover_applies(
    refusal: &crate::audio::active_session::CompanionRefusal,
    recorder_paused: bool,
) -> bool {
    matches!(
        refusal,
        crate::audio::active_session::CompanionRefusal::OtherMeeting { .. }
    ) && recorder_paused
}

/// The handover in flight, if any: (meeting_code, new session id). A repeated
/// start for the same code gets the same id back instead of a second handover.
static PENDING_HANDOVER: std::sync::Mutex<Option<(String, String)>> =
    std::sync::Mutex::new(None);

async fn session_start<R: Runtime>(
    State(st): State<IngestState<R>>,
    headers: HeaderMap,
    Json(req): Json<SessionStartReq>,
) -> Result<Json<SessionStartResp>, StatusCode> {
    if !authed(&headers, &st) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let title = req
        .title
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| "Google Meet".to_string());

    let code = req.meeting_code.as_deref().unwrap_or("adhoc");

    // Miting owns the recorder. Emitting `gmeet-start-recording` regardless of
    // what the app was doing meant a Meet started while the user was recording
    // something else left the extension believing it had a session that never
    // began — captions with no audio behind them. Refuse instead, with a reason
    // the extension can show.
    let takeover_old = match crate::audio::active_session::admit_companion(code) {
        Ok(()) => None,
        Err(refusal) => {
            let paused = crate::audio::recording_commands::is_recording_paused().await;
            let old = crate::audio::active_session::current().and_then(|s| s.companion);
            match (handover_applies(&refusal, paused), old) {
                (true, Some(old)) => {
                    // The same new Meet asking again while its handover is in
                    // flight gets the pending id back, not a second handover.
                    // Clone out of the lock before awaiting below: the guard
                    // is not Send, and `if let` keeps its scrutinee's
                    // temporaries alive for the whole block.
                    let pending = PENDING_HANDOVER.lock().unwrap().clone();
                    if let Some((pending_code, pending_id)) = pending {
                        if pending_code == code {
                            let seq = next_block_seq_for(&st, &pending_id).await;
                            return Ok(Json(SessionStartResp {
                                meeting_id: pending_id,
                                resumed: false,
                                admitted: true,
                                reason: None,
                                next_block_seq: seq,
                            }));
                        }
                    }
                    Some(old)
                }
                _ => {
                    log::warn!("gmeet ingest: refusing session_start for {code}: {refusal:?}");
                    // Tell the app too, not just the extension: the user may be
                    // looking at Miting rather than the Meet tab, and a refusal
                    // nobody sees reads as the button doing nothing.
                    let _ = st.app.emit(
                        "gmeet-start-refused",
                        json!({ "reason": refusal.message(), "meeting_code": code }),
                    );
                    return Ok(Json(SessionStartResp::refused(refusal.message())));
                }
            }
        }
    };
    let requested_id = req
        .session_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    // Miting is authoritative for resumability. Honor `resume` ONLY if the id
    // the extension wants to resume is still the one we hold as resumable for
    // this code — it may have been finalized (grace expiry / "Stop & summarize
    // now") between the extension's resume-check and this start POST. Otherwise
    // start fresh under a brand-new id, never reusing a possibly-finalized id
    // (which would append a new meeting's captions to an already-summarized
    // session — the contamination bug this guards against).
    let resume_state = st.app.try_state::<GmeetResumeState>();
    let reusable_id = resume_state.as_ref().and_then(|rs| rs.reusable(code));
    let (gmeet_session_id, resume) = match (req.resume, requested_id) {
        // Resume honored: the id the extension wants is still the reusable one
        // (paused in its grace window, or still actively recording).
        (true, Some(req_id)) if reusable_id.as_deref() == Some(req_id) => {
            (req_id.to_string(), true)
        }
        // Resume requested but stale (finalized since the extension checked) →
        // mint a fresh id; never reuse a possibly-finalized id.
        (true, _) => (format!("gmeet-{code}-{}", uuid::Uuid::new_v4()), false),
        // Fresh start, but this meeting code already has a live/paused session:
        // the extension (content script or SW) restarted and lost its id. Adopt
        // the existing session instead of forking a second one — forking
        // orphaned all captions sent under the old id (the captions=0 bug).
        (false, _) if reusable_id.is_some() => {
            let id = reusable_id.clone().unwrap_or_default();
            log::info!("gmeet ingest: adopting existing session {id} for code {code}");
            (id, true)
        }
        // Fresh start with the extension's own id.
        (false, Some(req_id)) => (req_id.to_string(), false),
        // Fresh start, minting an id (extension omitted one).
        (false, None) => (format!("gmeet-{code}-{}", uuid::Uuid::new_v4()), false),
    };

    // Record the (session_id -> code) mapping and drop any resumable entry for
    // this code: while actively recording it is not a pending-resume candidate.
    if let Some(rs) = resume_state.as_ref() {
        rs.on_start(&gmeet_session_id, code);
    }

    // Remember which Meet this session belongs to, so the saved meeting can
    // link back to the call. Upsert: a resume must not erase the URL the
    // first join stored.
    if let Ok(pool) = pool_from(&st) {
        let _ = sqlx::query(
            "INSERT INTO gmeet_session_meta (gmeet_session_id, meeting_code, meeting_url, created_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(gmeet_session_id) DO UPDATE SET
               meeting_url = COALESCE(excluded.meeting_url, gmeet_session_meta.meeting_url)",
        )
        .bind(&gmeet_session_id)
        .bind(code)
        .bind(req.meeting_url.as_deref().filter(|u| !u.trim().is_empty()))
        .bind(now_iso())
        .execute(&pool)
        .await
        .map_err(|e| log::warn!("gmeet ingest: session meta not stored: {e}"));
    }

    // Resuming a session the app holds paused is a recorder operation, not a
    // new start: resume directly and tell the frontend afterwards. Emitting a
    // start for it made the frontend re-request a recording that was already
    // running, and the request died against the already-recording guard.
    let held_paused = crate::audio::active_session::current()
        .map(|s| s.meeting_code() == Some(code))
        .unwrap_or(false)
        && crate::audio::recording_commands::is_recording_paused().await;
    if held_paused {
        grace::cancel(&st.app);
        grace::mark_seen();
        if let Err(e) = crate::audio::recording_commands::resume_recording(st.app.clone()).await {
            log::warn!("gmeet ingest: resume failed: {e}");
        }
        let _ = st.app.emit(
            "gmeet-start-recording",
            json!({
                "gmeet_session_id": gmeet_session_id,
                "title": title,
                "meeting_code": req.meeting_code,
                "resume": true,
            }),
        );
        log::info!("gmeet ingest: session_start {gmeet_session_id} resumed the paused recorder");
        let seq = next_block_seq_for(&st, &gmeet_session_id).await;
        return Ok(Json(SessionStartResp {
            meeting_id: gmeet_session_id,
            resumed: true,
            admitted: true,
            reason: None,
            next_block_seq: seq,
        }));
    }

    // The ingest server owns the start. It opens the session first — so
    // `/gmeet/state` answers for this Meet from this moment — then launches
    // the recorder itself, exactly as the resume path above already does.
    //
    // The start used to travel through the webview instead: an event, a
    // sessionStorage write, a route navigation, a debounced DOM event, and an
    // invoke back into Rust, with a pending claim expiring on a timer to
    // carry the Meet across. Any of those hops failing produced the signature
    // bug of this feature: audio recorded, captions refused, both UIs sure of
    // a different state.
    if let Some(old) = takeover_old {
        // Kick the old session's finalize off in the webview (the stop
        // pipeline lives there — save, diarization, summary — and runs in the
        // background), then launch the new Meet the moment the recorder frees.
        log::info!(
            "gmeet ingest: grace handover {} -> {code}",
            old.meeting_code
        );
        grace::cancel(&st.app);
        let _ = st.app.emit(
            "gmeet-stop-recording",
            json!({ "gmeet_session_id": old.session_id, "silent": true }),
        );
        *PENDING_HANDOVER.lock().unwrap() = Some((code.to_string(), gmeet_session_id.clone()));
        let app = st.app.clone();
        let h_code = code.to_string();
        let h_title = title.clone();
        let h_id = gmeet_session_id.clone();
        tauri::async_runtime::spawn(async move {
            let mut waited_ms: u64 = 0;
            while crate::audio::active_session::current().is_some() {
                if waited_ms >= 45_000 {
                    log::error!(
                        "gmeet ingest: handover to {h_code} timed out waiting for the old recorder"
                    );
                    let _ = app.emit(
                        "recording-error",
                        format!(
                            "The previous meeting is still finalizing, so recording for {h_code} could not start. Try again from the Meet toolbar."
                        ),
                    );
                    *PENDING_HANDOVER.lock().unwrap() = None;
                    return;
                }
                tokio::time::sleep(std::time::Duration::from_millis(250)).await;
                waited_ms += 250;
            }
            spawn_companion_launch(&app, &h_code, &h_title, &h_id, false);
            *PENDING_HANDOVER.lock().unwrap() = None;
        });
    } else {
        spawn_companion_launch(&st.app, code, &title, &gmeet_session_id, resume);
    }

    log::info!(
        "gmeet ingest: session_start -> {} (resume={}, requested_resume={}, participants={})",
        gmeet_session_id,
        resume,
        req.resume,
        req.participants.len()
    );
    let seq = next_block_seq_for(&st, &gmeet_session_id).await;
    Ok(Json(SessionStartResp {
        meeting_id: gmeet_session_id,
        resumed: resume,
        admitted: true,
        reason: None,
        next_block_seq: seq,
    }))
}

async fn session_pause<R: Runtime>(
    State(st): State<IngestState<R>>,
    headers: HeaderMap,
    Json(req): Json<SessionPauseReq>,
) -> Result<Json<Value>, StatusCode> {
    if !authed(&headers, &st) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    // Only the session the app is running may pause it. A stale tab replaying
    // a pause for a dead id used to pause whatever was recording instead.
    if !session_is_current(&req.meeting_id) {
        log::warn!(
            "gmeet ingest: ignoring pause for non-current session {}",
            req.meeting_id
        );
        return Ok(Json(json!({ "paused": false, "reason": "unknown_session" })));
    }
    // Meet closed/paused: the session becomes resumable (by its meeting code)
    // until it is resumed or finalized.
    if let Some(rs) = st.app.try_state::<GmeetResumeState>() {
        rs.on_pause(&req.meeting_id);
    }
    // A pause the user asked for is just a pause. Routing it through the
    // grace window — built for *leaving* a Meet — put a finalize countdown on
    // a recording the user intended to continue.
    if req.user_requested.unwrap_or(false) {
        if let Err(e) = crate::audio::recording_commands::pause_recording(st.app.clone()).await {
            log::warn!("gmeet ingest: user pause failed: {e}");
        }
        let _ = st.app.emit(
            "gmeet-user-pause",
            json!({ "gmeet_session_id": req.meeting_id }),
        );
        log::info!(
            "gmeet ingest: session_pause {} (user pause, no grace)",
            req.meeting_id
        );
        return Ok(Json(json!({ "paused": true })));
    }
    // Meet was left: pause the recorder and open the grace window HERE. The
    // webview used to do both off this event — a countdown in a setInterval
    // and an invoke — and either going missing left a session recording a
    // meeting that had ended. The event below is a view update only now.
    if let Err(e) = crate::audio::recording_commands::pause_recording(st.app.clone()).await {
        log::warn!("gmeet ingest: pause on leave failed: {e}");
    }
    let grace_code = crate::audio::active_session::current()
        .and_then(|s| s.companion)
        .filter(|c| c.session_id == req.meeting_id)
        .map(|c| c.meeting_code);
    match grace_code {
        Some(code) => grace::begin(&st.app, code, req.meeting_id.clone()),
        None => log::warn!(
            "gmeet ingest: pause for {} does not match the active session; no grace window",
            req.meeting_id
        ),
    }
    let _ = st.app.emit(
        "gmeet-pause-recording",
        json!({ "gmeet_session_id": req.meeting_id }),
    );
    log::info!(
        "gmeet ingest: session_pause {} (emitted gmeet-pause-recording)",
        req.meeting_id
    );
    Ok(Json(json!({ "paused": true })))
}

async fn captions<R: Runtime>(
    State(st): State<IngestState<R>>,
    headers: HeaderMap,
    Json(req): Json<CaptionsReq>,
) -> Result<StatusCode, StatusCode> {
    if !authed(&headers, &st) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    // Rows exist only for the one session the app honors right now. Without
    // this, any tab that still held an old id kept writing into it — the
    // server-side half of "captions from meeting B inside meeting A".
    if !session_is_current(&req.meeting_id) {
        log::warn!(
            "gmeet ingest: dropping captions for non-current session {}",
            req.meeting_id
        );
        return Err(StatusCode::GONE);
    }
    let pool = pool_from(&st)?;
    let now = now_iso();
    grace::mark_seen();
    // req.meeting_id carries the gmeet_session_id (the value returned by start).
    for cap in &req.captions {
        let text = cap.text.trim();
        if text.is_empty() {
            continue;
        }
        let speaker = cap
            .speaker
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        // The block-addressed path: the extension names the exact Meet block
        // this text belongs to, so storing it is a plain upsert — no guessing
        // from prefixes which row an update means. Meet revises EARLIER
        // blocks while later ones grow, which no last-row heuristic can
        // follow; per-block identity can.
        if let Some(block_seq) = cap.block_seq {
            sqlx::query(
                "INSERT INTO gmeet_captions (gmeet_session_id, speaker, text, ts_ms, created_at, block_seq)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(gmeet_session_id, block_seq) DO UPDATE SET
                   text = excluded.text,
                   speaker = COALESCE(excluded.speaker, gmeet_captions.speaker),
                   ts_ms = COALESCE(excluded.ts_ms, gmeet_captions.ts_ms)",
            )
            .bind(&req.meeting_id)
            .bind(speaker)
            .bind(text)
            .bind(cap.ts_ms)
            .bind(&now)
            .bind(block_seq)
            .execute(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let id: i64 = sqlx::query_scalar(
                "SELECT id FROM gmeet_captions WHERE gmeet_session_id = ? AND block_seq = ?",
            )
            .bind(&req.meeting_id)
            .bind(block_seq)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            emit_live_caption(&st, id, speaker, text);
            continue;
        }
        // Meet re-sends an utterance as it grows, so the LAST row of the
        // session is usually an earlier frame of this very sentence. Matching
        // by speaker as well split one utterance in two whenever the speaker
        // name rendered a frame late (null first, "You" after) — the text
        // itself is the identity, and classify already tells strangers apart.
        let previous: Option<(i64, Option<String>, String)> = sqlx::query_as(
            "SELECT id, speaker, text FROM gmeet_captions
             WHERE gmeet_session_id = ?
             ORDER BY id DESC LIMIT 1",
        )
        .bind(&req.meeting_id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        // Two DIFFERENT named speakers are never one utterance, however the
        // text compares; an unnamed side matches anything.
        let speaker_compatible = match (&previous, speaker) {
            (Some((_, Some(prev_s), _)), Some(s)) => prev_s == s,
            _ => true,
        };
        let comparable = if speaker_compatible {
            previous.as_ref().map(|(_, _, t)| t.as_str())
        } else {
            None
        };

        match caption_dedup::classify(comparable, text) {
            caption_dedup::CaptionWrite::Skip => continue,
            caption_dedup::CaptionWrite::ReplacePrevious => {
                let (id, _, _) = previous.expect("ReplacePrevious implies a previous row");
                // The speaker rides along: the first frame of a turn often
                // arrives before Meet renders the name.
                sqlx::query("UPDATE gmeet_captions SET text = ?, speaker = IFNULL(?, speaker), ts_ms = ? WHERE id = ?")
                    .bind(text)
                    .bind(speaker)
                    .bind(cap.ts_ms)
                    .bind(id)
                    .execute(&pool)
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                emit_live_caption(&st, id, speaker, text);
            }
            caption_dedup::CaptionWrite::Insert => {
                sqlx::query(
                    "INSERT INTO gmeet_captions (gmeet_session_id, speaker, text, ts_ms, created_at)
                     VALUES (?, ?, ?, ?, ?)",
                )
                .bind(&req.meeting_id)
                .bind(speaker)
                .bind(text)
                .bind(cap.ts_ms)
                .bind(&now)
                .execute(&pool)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
                    .fetch_one(&pool)
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                emit_live_caption(&st, id, speaker, text);
            }
        }
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Show the caption in the app as it arrives.
///
/// Carries the row id rather than a running counter, because Meet re-sends an
/// utterance as it grows and the dedup above rewrites that same row: keyed by
/// id, the line the user is watching grows in place instead of repeating.
/// Deliberately a separate event from `transcript-update` — that one is the
/// local engine's, and its listener drops any id it has already seen, which
/// would freeze a companion caption at its first two words.
fn emit_live_caption<R: Runtime>(
    st: &IngestState<R>,
    id: i64,
    speaker: Option<&str>,
    text: &str,
) {
    // Recorder-relative seconds, so the live view can stamp the line the same
    // way the saved transcript will. The view used to fall back to the line's
    // index, which read as [00:00] [00:01] [00:02] whatever the clock said.
    let at = crate::audio::recording_commands::active_duration_secs().map(|s| s as u64);
    match st.app.emit(
        "gmeet-caption",
        json!({ "id": id, "speaker": speaker, "text": text, "at": at }),
    ) {
        Ok(()) => log::debug!("gmeet live caption #{id} -> app ({} chars)", text.len()),
        // Not fatal: the caption is already stored, only the live view misses it.
        Err(e) => log::warn!("gmeet live caption #{id} not delivered to the app: {e}"),
    }
}

async fn participants<R: Runtime>(
    State(st): State<IngestState<R>>,
    headers: HeaderMap,
    Json(_req): Json<ParticipantsReq>,
) -> Result<StatusCode, StatusCode> {
    if !authed(&headers, &st) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    // Speaker names come from the captions themselves; the roster is accepted
    // but not separately stored in this flow (kept for a future summary hint).
    Ok(StatusCode::NO_CONTENT)
}

async fn session_end<R: Runtime>(
    State(st): State<IngestState<R>>,
    headers: HeaderMap,
    Json(req): Json<SessionEndReq>,
) -> Result<Json<Value>, StatusCode> {
    if !authed(&headers, &st) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    // Only the running session may be finalized from the wire. A stale tab's
    // end for a dead id used to emit a stop that hit whatever recording was
    // live — and an end arriving mid-finalize double-finalized it.
    if !session_is_current(&req.meeting_id) {
        log::warn!(
            "gmeet ingest: ignoring end for non-current session {}",
            req.meeting_id
        );
        return Ok(Json(json!({ "stopping": false, "reason": "unknown_session" })));
    }
    // Finalized → no longer resumable. (The frontend clears via
    // gmeet_clear_resumable on its own finalize path; this covers a session_end
    // that arrives over the wire.)
    if let Some(rs) = st.app.try_state::<GmeetResumeState>() {
        rs.clear(&req.meeting_id);
    }
    grace::cancel(&st.app);
    // Tell the frontend to stop recording + save; it then invokes
    // gmeet_finalize_diarization once the real meeting_id exists.
    let _ = st.app.emit(
        "gmeet-stop-recording",
        json!({ "gmeet_session_id": req.meeting_id }),
    );
    log::info!(
        "gmeet ingest: session_end {} (emitted gmeet-stop-recording)",
        req.meeting_id
    );
    Ok(Json(json!({ "stopping": true })))
}

/// GET /gmeet/session/resume-check?meeting_code=X — the extension asks this
/// before starting so it can reuse a paused session's id (resume) instead of
/// running its own timer. Miting is the single source of truth.
/// The whole recording state, so the companion can mirror it rather than
/// maintain a second copy. See `state_view` for why this replaced
/// field-by-field reconciliation.
async fn recording_state<R: Runtime>(
    State(st): State<IngestState<R>>,
    headers: HeaderMap,
    Query(q): Query<ResumeCheckQuery>,
) -> Result<Json<state_view::StateView>, StatusCode> {
    if !authed(&headers, &st) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let asking = q.meeting_code.as_deref();
    // The extension's poll is the heartbeat: the watchdog synthesizes the
    // pause that never arrived once this goes quiet for a live session.
    if let Some(code) = asking {
        if crate::audio::active_session::current()
            .and_then(|s| s.companion)
            .is_some_and(|c| c.meeting_code == code)
        {
            grace::mark_seen();
        }
    }
    let grace = asking.and_then(|code| {
        st.app
            .try_state::<GmeetResumeState>()
            .and_then(|rs| rs.resume_check(code))
            .map(|_| code.to_string())
    });
    Ok(Json(state_view::render(state_view::Query {
        session: crate::audio::active_session::current(),
        paused: crate::audio::recording_commands::is_recording_paused().await,
        grace_code: grace,
        grace_window_code: grace::state().map(|(code, _)| code),
        asking_code: asking,
        elapsed_seconds: crate::audio::recording_commands::active_duration_secs().map(|s| s as u64),
        audio_error: crate::audio::audio_error::current(),
    })))
}

async fn resume_check<R: Runtime>(
    State(st): State<IngestState<R>>,
    headers: HeaderMap,
    Query(q): Query<ResumeCheckQuery>,
) -> Result<Json<ResumeCheckResp>, StatusCode> {
    if !authed(&headers, &st) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let code = q.meeting_code.as_deref().unwrap_or("adhoc");
    let session_id = st
        .app
        .try_state::<GmeetResumeState>()
        .and_then(|rs| rs.resume_check(code));
    Ok(Json(ResumeCheckResp {
        resumable: session_id.is_some(),
        session_id,
    }))
}

// ---- server bootstrap ----------------------------------------------------

/// Pairing info for the Settings UI (the extension needs the token + URL).
#[derive(Serialize)]
pub struct GmeetPairingInfo {
    pub base_url: String,
    pub token: String,
}

/// Tauri command: return the ingest server URL + pairing token for the extension.
#[tauri::command]
pub fn gmeet_pairing_info<R: Runtime>(app: AppHandle<R>) -> GmeetPairingInfo {
    GmeetPairingInfo {
        base_url: format!("http://127.0.0.1:{GMEET_INGEST_PORT}"),
        token: load_or_create_token(&app),
    }
}

/// Tauri command: the frontend calls this when it finalizes a gmeet recording
/// (grace expiry or "Stop & summarize now") so the session stops being a
/// resume candidate. Idempotent; a no-op if the session was never tracked.
#[tauri::command]
pub fn gmeet_clear_resumable<R: Runtime>(app: AppHandle<R>, session_id: String) {
    if let Some(rs) = app.try_state::<GmeetResumeState>() {
        rs.clear(&session_id);
    }
}

/// Build the router (exposed for tests).
fn router<R: Runtime>(state: IngestState<R>) -> Router {
    Router::new()
        .route("/gmeet/health", get(health::<R>))
        .route("/gmeet/session/start", post(session_start::<R>))
        .route("/gmeet/session/pause", post(session_pause::<R>))
        .route("/gmeet/session/end", post(session_end::<R>))
        .route("/gmeet/session/resume-check", get(resume_check::<R>))
        .route("/gmeet/state", get(recording_state::<R>))
        .route("/gmeet/captions", post(captions::<R>))
        .route("/gmeet/participants", post(participants::<R>))
        .with_state(state)
}

/// Start the ingest server on 127.0.0.1:GMEET_INGEST_PORT. Call from the Tauri
/// setup hook inside `tauri::async_runtime::spawn`.
pub async fn serve<R: Runtime>(app: AppHandle<R>) {
    let token = Arc::new(load_or_create_token(&app));
    let app_for_watchdog = app.clone();
    let state = IngestState {
        app,
        token: token.clone(),
    };
    let addr = SocketAddr::from(([127, 0, 0, 1], GMEET_INGEST_PORT));

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            log::error!("gmeet ingest: failed to bind {addr}: {e}");
            return;
        }
    };
    grace::spawn_watchdog(app_for_watchdog);
    log::info!("gmeet ingest server listening on http://{addr}");
    if let Err(e) = axum::serve(listener, router(state)).await {
        log::error!("gmeet ingest server error: {e}");
    }
}

#[cfg(test)]
mod tests {
    use super::handover_applies;

    #[test]
    fn a_paused_other_meeting_hands_over() {
        let refusal = crate::audio::active_session::CompanionRefusal::OtherMeeting {
            meeting_code: "abc-defg-hij".into(),
        };
        assert!(handover_applies(&refusal, true));
    }

    #[test]
    fn a_live_other_meeting_and_a_local_recording_still_refuse() {
        let other = crate::audio::active_session::CompanionRefusal::OtherMeeting {
            meeting_code: "abc-defg-hij".into(),
        };
        // Recording live (not paused): the refusal protects a real recording.
        assert!(!handover_applies(&other, false));
        // The user's own local recording is never handed over, paused or not.
        let local = crate::audio::active_session::CompanionRefusal::AppIsRecording;
        assert!(!handover_applies(&local, true));
        assert!(!handover_applies(&local, false));
    }

    use super::*;

    #[test]
    fn generate_token_is_64_hex() {
        let t = generate_token();
        assert_eq!(t.len(), 64);
        assert!(t.chars().all(|c| c.is_ascii_hexdigit()));
    }

    // ---- GmeetResumeState: the resume/desync bug family --------------------

    const CODE: &str = "abc-defg-hij";

    #[test]
    fn fresh_meeting_is_not_resumable() {
        let s = GmeetResumeState::default();
        s.on_start("sess-1", CODE);
        // Started but never paused → nothing to resume.
        assert_eq!(s.resume_check(CODE), None);
    }

    #[test]
    fn active_session_is_adoptable_by_session_start() {
        // Extension restarted mid-meeting and lost its id: session_start must
        // re-adopt the live session instead of forking a second one (the fork
        // orphaned every caption sent under the first id → captions=0).
        let s = GmeetResumeState::default();
        s.on_start("sess-1", CODE);
        assert_eq!(s.reusable(CODE), Some("sess-1".to_string()));
        // But the public resume-check contract stays paused-only.
        assert_eq!(s.resume_check(CODE), None);
    }

    #[test]
    fn pause_moves_session_from_active_to_resumable() {
        let s = GmeetResumeState::default();
        s.on_start("sess-1", CODE);
        s.on_pause("sess-1");
        assert_eq!(s.resume_check(CODE), Some("sess-1".to_string()));
        assert_eq!(s.reusable(CODE), Some("sess-1".to_string()));
    }

    #[test]
    fn finalize_clears_active_adoption_too() {
        let s = GmeetResumeState::default();
        s.on_start("sess-1", CODE);
        s.clear("sess-1");
        assert_eq!(
            s.reusable(CODE),
            None,
            "finalized id must never be re-adopted"
        );
    }

    #[test]
    fn pause_makes_session_resumable() {
        let s = GmeetResumeState::default();
        s.on_start("sess-1", CODE);
        s.on_pause("sess-1");
        assert_eq!(s.resume_check(CODE), Some("sess-1".to_string()));
    }

    #[test]
    fn resume_clears_resumability_until_next_pause() {
        let s = GmeetResumeState::default();
        s.on_start("sess-1", CODE);
        s.on_pause("sess-1");
        // Rejoin resumes the same id → actively recording, not resumable.
        s.on_start("sess-1", CODE);
        assert_eq!(s.resume_check(CODE), None);
    }

    #[test]
    fn finalize_clears_resumability() {
        // "Stop & summarize now" (or grace expiry) → next join of this Meet is
        // fresh, so the finalized session's id is never reused (no caption
        // contamination).
        let s = GmeetResumeState::default();
        s.on_start("sess-1", CODE);
        s.on_pause("sess-1");
        s.clear("sess-1");
        assert_eq!(s.resume_check(CODE), None);
    }

    #[test]
    fn resumed_session_can_be_resumed_again() {
        // Regression guard: clearing on resume (or dropping the session->code
        // mapping too eagerly) would break a *second* resume of the same Meet.
        let s = GmeetResumeState::default();
        s.on_start("sess-1", CODE);
        s.on_pause("sess-1");
        s.on_start("sess-1", CODE); // resume #1
        s.on_pause("sess-1"); // paused again
        assert_eq!(s.resume_check(CODE), Some("sess-1".to_string()));
    }

    #[test]
    fn clear_only_drops_entry_still_pointing_at_that_session() {
        // A newer session replaced the resumable slot for this code; a late
        // finalize of the OLD session must not wipe the new one's resumability.
        let s = GmeetResumeState::default();
        s.on_start("old", CODE);
        s.on_pause("old"); // resumable[CODE] = old
        s.on_start("new", CODE); // resumable[CODE] cleared, session_code[new]=CODE
        s.on_pause("new"); // resumable[CODE] = new
        s.clear("old"); // stale finalize of old
        assert_eq!(s.resume_check(CODE), Some("new".to_string()));
    }

    #[test]
    fn pause_of_untracked_session_is_noop() {
        // A pause for a session we never saw start (e.g. after a restart) must
        // not invent a resumable entry keyed by a mystery code.
        let s = GmeetResumeState::default();
        s.on_pause("ghost");
        assert_eq!(s.resume_check(CODE), None);
        assert_eq!(s.resume_check("adhoc"), None);
    }
}

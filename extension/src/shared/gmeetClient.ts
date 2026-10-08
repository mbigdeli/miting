/**
 * Miting Google Meet ingest client.
 *
 * Replaces the old Native Messaging transport. The companion extension now
 * POSTs Google Meet captions / participants / session lifecycle to the miting
 * desktop app's localhost ingest server (see src-tauri/src/gmeet_ingest).
 *
 * Miting owns audio (system-audio loopback) and all AI/model concerns; the
 * extension's only job is to feed Meet's named captions + roster + metadata.
 */

import type {
  CaptionEventRequest,
  ParticipantSnapshotRequest,
  SessionStartRequest,
} from "./ingestTypes.js";

const PAIRING_KEY = "mcs_gmeet_pairing";
const DEFAULT_BASE_URL = "http://127.0.0.1:5167";

export interface GmeetPairing {
  baseUrl: string;
  token: string;
}

export interface GmeetResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** Read the stored pairing (base URL + token) the user set from Miting Settings. */
export async function getGmeetPairing(): Promise<GmeetPairing | null> {
  const stored = await chrome.storage.local.get(PAIRING_KEY);
  const raw = stored[PAIRING_KEY] as Partial<GmeetPairing> | undefined;
  if (!raw || typeof raw.token !== "string" || raw.token.length === 0) {
    return null;
  }
  return {
    baseUrl: typeof raw.baseUrl === "string" && raw.baseUrl ? raw.baseUrl : DEFAULT_BASE_URL,
    token: raw.token,
  };
}

export async function setGmeetPairing(pairing: GmeetPairing): Promise<void> {
  await chrome.storage.local.set({
    [PAIRING_KEY]: {
      baseUrl: pairing.baseUrl || DEFAULT_BASE_URL,
      token: pairing.token,
    },
  });
}

/**
 * Optional hook the service worker registers to re-fetch pairing from the
 * native host (see shared/autoPairing.ts). Injected instead of imported to
 * keep this module free of a gmeetClient <-> autoPairing import cycle.
 */
let pairingRefresher: (() => Promise<GmeetPairing | null>) | null = null;

export function setPairingRefresher(refresh: () => Promise<GmeetPairing | null>): void {
  pairingRefresher = refresh;
}


/**
 * GET an authenticated endpoint, re-pairing once if the token is stale.
 *
 * The desktop app mints its token into a file the native host also reads, so a
 * mismatch heals the moment the extension asks the host again. `post` already
 * did this; the GETs did not, and they are the two calls that matter most —
 * `/gmeet/state` is the five-second poll every capture decision comes from, and
 * `session/resume-check` runs before every start. A stale token made both
 * return `http_401` forever: the poll went quiet, the start reported "Miting
 * could not start recording this meeting", and nothing ever re-paired.
 */
async function authedGet(
  pairing: GmeetPairing,
  path: string,
): Promise<{ resp: Response; pairing: GmeetPairing } | null> {
  const send = (p: GmeetPairing) =>
    fetch(`${p.baseUrl}${path}`, { headers: { Authorization: `Bearer ${p.token}` } });
  try {
    const first = await send(pairing);
    if (first.status !== 401 || !pairingRefresher) {
      return { resp: first, pairing };
    }
    const refreshed = await pairingRefresher();
    if (!refreshed || refreshed.token === pairing.token) {
      return { resp: first, pairing };
    }
    return { resp: await send(refreshed), pairing: refreshed };
  } catch {
    return null;
  }
}

async function postOnce<T = unknown>(
  pairing: GmeetPairing,
  path: string,
  body: unknown,
): Promise<GmeetResult<T>> {
  try {
    const resp = await fetch(`${pairing.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pairing.token}`,
      },
      body: JSON.stringify(body),
    });
    if (resp.status === 401) {
      return { ok: false, error: "unauthorized" };
    }
    if (!resp.ok) {
      return { ok: false, error: `http_${resp.status}` };
    }
    // Some endpoints return 204 No Content.
    const text = await resp.text();
    const data = text ? (JSON.parse(text) as T) : undefined;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function post<T = unknown>(path: string, body: unknown): Promise<GmeetResult<T>> {
  let pairing = await getGmeetPairing();
  if (!pairing && pairingRefresher) {
    pairing = await pairingRefresher();
  }
  if (!pairing) {
    return { ok: false, error: "not_paired" };
  }
  const first = await postOnce<T>(pairing, path, body);
  // Stale token (e.g. app re-minted it): refresh over native messaging once, retry once.
  if (!first.ok && first.error === "unauthorized" && pairingRefresher) {
    const refreshed = await pairingRefresher();
    if (refreshed && refreshed.token !== pairing.token) {
      return postOnce<T>(refreshed, path, body);
    }
  }
  return first;
}

/** Health probe — used to show connection status in the popup/options. */
/** What Miting reports it is recording right now. */
export interface AppRecordingState {
  active: boolean;
  paused: boolean;
  companion: boolean;
  meeting_code: string | null;
}

export async function checkGmeetHealth(): Promise<
  GmeetResult<{ recording?: AppRecordingState; authorized?: boolean }>
> {
  const pairing = await getGmeetPairing();
  if (!pairing) {
    return { ok: false, error: "not_paired" };
  }
  try {
    // The app answers health either way, but only grades the token it is
    // shown. Without the header `authorized` was always false, so the worker
    // re-paired through the native host every minute.
    const resp = await fetch(`${pairing.baseUrl}/gmeet/health`, {
      headers: { Authorization: `Bearer ${pairing.token}` },
    });
    if (!resp.ok) {
      return { ok: false, error: `http_${resp.status}` };
    }
    const data = (await resp.json().catch(() => ({}))) as {
      recording?: AppRecordingState;
      authorized?: boolean;
    };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- session continuity across pause/resume -------------------------------
// Miting — not the extension — is the single source of truth for whether a
// just-left Meet can be resumed into the same session. Before starting we ask
// GET /gmeet/session/resume-check?meeting_code=X; if miting reports a paused,
// not-yet-finalized session for this code we reuse its id (resume), otherwise
// we mint a fresh one. Miting clears resumability when it finalizes (grace
// expiry / "Stop & summarize now") or resumes, so there is no independent
// extension timer to drift out of sync with the frontend grace countdown —
// which was the root of the resume/session-id desync bug family.

function genId(code: string): string {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2);
  return `gmeet-${code}-${rand}`;
}

interface ResumeCheck {
  resumable: boolean;
  session_id?: string | null;
}

/**
 * Ask miting whether this meeting_code has a resumable paused session. On any
 * failure (miting unreachable, unauthorized, bad response) we treat it as not
 * resumable so a fresh session is started rather than blocking the recording.
 */
async function resumeCheck(pairing: GmeetPairing, code: string): Promise<ResumeCheck> {
  try {
    const got = await authedGet(
      pairing,
      `/gmeet/session/resume-check?meeting_code=${encodeURIComponent(code)}`,
    );
    if (!got || !got.resp.ok) return { resumable: false };
    const data = (await got.resp.json()) as ResumeCheck;
    return {
      resumable: data.resumable === true,
      session_id: typeof data.session_id === "string" ? data.session_id : null,
    };
  } catch {
    return { resumable: false };
  }
}

export async function startSession(
  body: SessionStartRequest,
): Promise<GmeetResult<{ meeting_id: string; resumed: boolean; admitted?: boolean; reason?: string; next_block_seq?: number }>> {
  const pairing = await getGmeetPairing();
  if (!pairing) {
    return { ok: false, error: "not_paired" };
  }
  const code = body.meeting_code || "adhoc";
  const check = await resumeCheck(pairing, code);
  let sessionId: string;
  let resume = false;
  if (check.resumable && check.session_id) {
    sessionId = check.session_id;
    resume = true;
  } else {
    sessionId = genId(code);
  }

  // Miting validates `resume` authoritatively and returns the id it actually
  // used (in `meeting_id`), which may differ if the session was finalized in
  // the meantime — the caller adopts that returned id.
  return post("/gmeet/session/start", {
    meeting_code: body.meeting_code,
    title: body.meeting_title,
    participants: [],
    session_id: sessionId,
    resume,
  });
}

export async function sendCaption(
  meetingId: string,
  body: CaptionEventRequest,
): Promise<GmeetResult> {
  const tsMs =
    typeof body.start_offset_sec === "number" ? Math.round(body.start_offset_sec * 1000) : null;
  return post("/gmeet/captions", {
    meeting_id: meetingId,
    captions: [
      {
        speaker: body.speaker_hint_text ?? null,
        text: body.caption_text,
        ts_ms: tsMs,
        block_seq: body.block_seq ?? null,
      },
    ],
  });
}

export async function sendParticipants(
  meetingId: string,
  body: ParticipantSnapshotRequest,
): Promise<GmeetResult> {
  return post("/gmeet/participants", {
    meeting_id: meetingId,
    participants: body.participants.map((p) => p.display_name).filter(Boolean),
  });
}

/**
 * Meet closed/paused: pause miting, which marks the session resumable and
 * starts its grace window. Resumability is tracked by miting (keyed by meeting
 * code), so nothing is stored here.
 */
export async function pauseSession(
  meetingId: string,
  userRequested = false,
): Promise<GmeetResult> {
  // `user_requested` keeps a deliberate pause out of the grace window: leaving
  // a Meet is resumable-with-countdown, pressing pause is just pause.
  return post("/gmeet/session/pause", {
    meeting_id: meetingId,
    user_requested: userRequested,
  });
}

/**
 * Resume a session Miting holds paused. Same endpoint as start on purpose:
 * the server sees "same Meet, paused" and resumes the recorder directly.
 */
export async function resumeSession(meetingCode: string): Promise<GmeetResult> {
  const pairing = await getGmeetPairing();
  if (!pairing) {
    return { ok: false, error: "not_paired" };
  }
  const check = await resumeCheck(pairing, meetingCode);
  return post("/gmeet/session/start", {
    meeting_code: meetingCode,
    participants: [],
    session_id: check.session_id ?? genId(meetingCode),
    resume: true,
  });
}

/**
 * Finalize a session over the wire. Miting clears the session's resumability
 * on this path too (in addition to its own frontend finalize), so the next
 * join of this Meet starts fresh.
 */
export async function endSession(meetingId: string): Promise<GmeetResult> {
  return post("/gmeet/session/end", { meeting_id: meetingId });
}

/** Miting's whole recording state — the one answer the companion mirrors. */
export interface AppState {
  phase: "idle" | "recording" | "paused" | "grace";
  source?: "local" | "companion";
  meeting_code?: string;
  companion_should_capture: boolean;
  elapsed_seconds?: number;
  /**
   * Set when the recording has no microphone. The session deliberately keeps
   * running on Meet's captions, so nothing else tells the user that the audio
   * half of it is missing — and they are looking at this tab, not the app.
   */
  audio_error?: string;
}

/**
 * Ask Miting what is being recorded. The companion renders from this instead
 * of reconciling its own flags, which made it a second owner of the state.
 */
export async function fetchAppState(meetingCode: string): Promise<GmeetResult<AppState>> {
  const pairing = await getGmeetPairing();
  if (!pairing) {
    return { ok: false, error: "not_paired" };
  }
  const got = await authedGet(
    pairing,
    `/gmeet/state?meeting_code=${encodeURIComponent(meetingCode)}`,
  );
  if (!got) {
    return { ok: false, error: "unreachable" };
  }
  if (!got.resp.ok) {
    return { ok: false, error: `http_${got.resp.status}` };
  }
  try {
    return { ok: true, data: (await got.resp.json()) as AppState };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

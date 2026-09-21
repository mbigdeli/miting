import { LocalServiceClient } from "../shared/localServiceClient.js";
import { nativeHostRequest } from "../shared/nativeHost.js";
import type { SessionStartRequest } from "../shared/ingestTypes.js";
import {
  startSession as gmeetStartSession,
  sendCaption as gmeetSendCaption,
  sendParticipants as gmeetSendParticipants,
  endSession as gmeetEndSession,
  pauseSession as gmeetPauseSession,
  resumeSession as gmeetResumeSession,
  checkGmeetHealth,
  fetchAppState,
  setPairingRefresher,
} from "../shared/gmeetClient.js";
import { ensureGmeetPairing } from "../shared/autoPairing.js";
import type { ExtensionMessage, SettingsAndSessionResponse } from "../shared/messages.js";
import type { CurrentMeetingSnapshot, RecordingReadiness } from "../shared/recordingsTypes.js";
import { extensionMessageSchema, liveCaptionLanguageSchema, meetingCaptureSettingsSchema } from "../shared/schemas.js";
import {
  getLastCaptionLanguage,
  getSessionState,
  getSettings,
  patchSessionState,
  setLastCaptionLanguage,
  setSettings,
} from "../shared/storage.js";
import { STORAGE_KEYS } from "../shared/storageKeys.js";
import { DEFAULT_SETTINGS } from "../shared/types.js";
import {
  forgetSession,
  listTabCaptures,
  rememberTabCapture,
  takeTabCapture,
} from "./tabCaptures.js";
import { setBadgeRecording } from "./badge.js";

const HEALTH_ALARM = "mcs-local-service-health";

const serviceClient = new LocalServiceClient(getSettings);

// Zero-touch pairing (doc 15): wire the native-host refresher into the gmeet
// client, then pair eagerly on every SW start. Both are fire-and-forget — the
// SW must register listeners synchronously and never block on async work here.
setPairingRefresher(() => ensureGmeetPairing(true));
void ensureGmeetPairing();



/**
 * Monotonic generation counter incremented on every CAPTURE_START / STOP.
 * If a STOP arrives while a slow START is still running (offscreen setup),
 * the START will detect the generation mismatch and abort instead of
 * overwriting the newer "stopped" state.
 */
let captureGeneration = 0;

/**
 * Pauses a session from the background when the Meet tab closes unexpectedly
 * (tab crash / pagehide not firing, so the content script's teardown never ran).
 *
 * Miting: this MUST use the gmeet HTTP ingest path (same as the normal
 * INGEST_SESSION_PAUSE handler), NOT the retired Native Messaging host — that
 * host is not installed in miting, so a native pause would silently fail
 * and the recording would run forever with no grace window. miting's frontend
 * grace controller finalizes on the 5-minute countdown if the user doesn't
 * rejoin.
 */
async function pauseSessionFromBackground(capture: { sessionId: string }): Promise<void> {
  console.info(`[MCS:bg] pausing session ${capture.sessionId} (tab closed)`);
  try {
    const pauseResult = await gmeetPauseSession(capture.sessionId);
    if (pauseResult.ok) {
      console.info("[MCS:bg] session paused ✓ (miting grace window will finalize if no rejoin)");
    } else {
      console.error(`[MCS:bg] session pause failed: ${pauseResult.error}`);
    }
  } catch (e) {
    console.error(`[MCS:bg] pauseSession error: ${e instanceof Error ? e.message : e}`);
  }
  await patchSessionState({
    isCaptureRunning: false,
    recordingTabId: null,
    currentSessionId: null,
    currentMeetingTitle: null,
    captureRecordingAccumMs: 0,
    captureRecordingSegmentStartedAt: null,
  }).catch(() => undefined);
}
function assertMeetSender(sender: chrome.runtime.MessageSender): void {
  if (!sender.url?.startsWith("https://meet.google.com/")) {
    throw new Error("invalid_sender");
  }
}

async function ensureDefaultSettingsPersisted(): Promise<void> {
  const raw = await chrome.storage.local.get(STORAGE_KEYS.settings);
  if (raw[STORAGE_KEYS.settings] === undefined) {
    await setSettings({ ...DEFAULT_SETTINGS });
  }
}

async function refreshServiceHealth(_ensureTray = false): Promise<void> {
  // Pair first: `/gmeet/health` is reachable without a token, but the popup
  // treats a missing pairing as "Desktop app unavailable". On macOS the host
  // now reads Application Support; this call is what stores the token.
  await ensureGmeetPairing();
  // Miting: health is the miting desktop app's HTTP gmeet ingest server,
  // NOT the retired Native Messaging host. (The old native host is uninstalled,
  // so serviceClient.checkHealth would always report "unavailable" and block
  // recording.) "connected" is the state the record gate requires.
  let health = await checkGmeetHealth();
  // `/gmeet/health` answers without a token so we can tell "Miting is not
  // running" from "Miting is running but will reject us", and it reports which.
  // Acting on that here means a token the app has re-minted is repaired on the
  // next health tick instead of waiting for something to fail with a 401 —
  // which is how the companion sat for a whole session showing "connected"
  // while recording could not start.
  if (health.ok && health.data?.authorized === false) {
    const refreshed = await ensureGmeetPairing(true);
    if (refreshed) {
      console.info("[MCS:bg] pairing token was stale — re-paired with the app");
      health = await checkGmeetHealth();
    }
  }
  await patchSessionState({
    localServiceStatus: health.ok ? "connected" : "unavailable",
  });
}

/** The slice of the app's answer a Meet tab decides from. */
interface AppStateForTab {
  phase: string;
  companion_should_capture: boolean;
  meeting_code: string | null;
}

/**
 * Ask Miting about ONE Meet and hand the answer back to the asking tab.
 *
 * This used to write the answer into a global `isCaptureRunning` flag that
 * every Meet tab obeyed. With two Meets open, tab B's "not yours" answer
 * flipped the flag, tab A read the flip as the user stopping and ENDED its
 * healthy session, then A's next poll did the same to B — the two-tab war
 * behind "the previous meeting got closed and then the new one stopped too".
 * The answer now travels back to the tab that asked and to no one else; the
 * only global writes left are display fields (timer, phase, errors) that no
 * tab makes capture decisions from.
 */
async function mirrorAppState(meetingCode: string): Promise<AppStateForTab | null> {
  const state = await fetchAppState(meetingCode);
  if (!state.ok || !state.data) return null;

  const session = await getSessionState();
  const shouldCapture = state.data.companion_should_capture === true;
  const phase = state.data.phase;

  // The widget's timer is the app's timer, rendered: elapsed seconds come from
  // Miting on every poll, and the widget only ticks forward between polls.
  // Counting locally is how the two clocks drifted apart.
  const elapsedMs =
    typeof state.data.elapsed_seconds === "number" ? state.data.elapsed_seconds * 1000 : null;
  const timerPatch =
    elapsedMs !== null
      ? {
          captureRecordingAccumMs: elapsedMs,
          captureRecordingSegmentStartedAt: phase === "recording" ? Date.now() : null,
        }
      : {};

  // Carried on every poll, not only on a transition: a microphone that never
  // opens leaves capture and phase steady, so a transition-only patch would
  // show the failure to nobody.
  const audioError = state.data.audio_error ?? null;
  const errorPatch =
    audioError !== null && session.lastError !== audioError ? { lastError: audioError } : {};

  // Display-only capture flag for the popup and badge: raised when the app
  // records a companion Meet, lowered only when the app records NOTHING.
  // "Busy with a different code" leaves it alone — that answer belongs to
  // another tab's recording, which is exactly the write that started the war.
  const capturePatch = shouldCapture
    ? { isCaptureRunning: true, isSessionPaused: false }
    : phase === "idle" || phase === "grace"
      ? { isCaptureRunning: false, isSessionPaused: phase === "grace" }
      : phase === "paused"
        ? { isCaptureRunning: false, isSessionPaused: true }
        : {};

  await patchSessionState({ appPhase: phase, ...capturePatch, ...timerPatch, ...errorPatch });

  return {
    phase,
    companion_should_capture: shouldCapture,
    meeting_code: state.data.meeting_code ?? null,
  };
}


function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readinessFromNativeStatus(data: unknown): RecordingReadiness | "processing" | "none" {
  if (!isRecord(data)) {
    return "none";
  }
  if (typeof data.last_error === "string" && data.last_error.length > 0) {
    return "failed";
  }
  const overall = typeof data.overall_state === "string" ? data.overall_state : "";
  if (overall === "active") {
    return "recording";
  }
  if (overall === "paused") {
    return "paused";
  }
  const files = isRecord(data.output_files) ? data.output_files : {};
  const processed = Array.isArray(files.processed) ? files.processed : [];
  const finalFiles = Array.isArray(files.final) ? files.final : [];
  const raw = Array.isArray(files.raw) ? files.raw : [];
  const hasAudio = processed.includes("processed/audio.mp3") || processed.includes("processed/audio.wav");
  const hasTranscript =
    finalFiles.includes("final/final_transcript.json") ||
    processed.includes("processed/transcript.json") ||
    raw.includes("raw/caption_events.jsonl");
  if (hasAudio && hasTranscript) {
    return "ready";
  }
  if (hasAudio) {
    return "audio_only";
  }
  if (hasTranscript) {
    return "transcript_only";
  }
  if (overall === "ended" || overall === "reprocessing") {
    return "processing";
  }
  return "none";
}

async function handleMessage(raw: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (!isRecord(raw) || typeof raw.type !== "string") {
    return { ok: false, error: "Invalid message" };
  }

  switch (raw.type) {
    case "PING":
      return { ok: true, pong: true };

    case "REQUEST_SETTINGS": {
      const settings = await getSettings();
      const session = await getSessionState();
      const lastCaptionLanguage = await getLastCaptionLanguage();
      const body: SettingsAndSessionResponse = {
        settings,
        session,
        lastCaptionLanguage,
      };
      return { ok: true, ...body };
    }

    case "REQUEST_SESSION_STATUS": {
      const session = await getSessionState();
      return { ok: true, session };
    }

    case "SETTINGS_UPDATED": {
      const parsed = meetingCaptureSettingsSchema.parse(raw.payload);
      await setSettings(parsed);
      await refreshServiceHealth();
      return { ok: true };
    }

    case "CAPTURE_PAUSE": {
      // A pause the user asked for: hand it to Miting and mirror whatever it
      // says. The session to pause is the SENDER TAB's, never a shared slot —
      // with two Meets open the slot pointed at whichever started last.
      const pauseCode =
        isRecord(raw.payload) && typeof raw.payload.meetingCode === "string"
          ? raw.payload.meetingCode
          : "";
      const captures = await listTabCaptures();
      const mine = sender.tab?.id !== undefined
        ? captures.find((c) => c.tabId === sender.tab?.id)
        : captures[0];
      if (!mine) return { ok: false, error: "no_active_session" };
      const r = await gmeetPauseSession(mine.sessionId, true);
      if (pauseCode) await mirrorAppState(pauseCode);
      return { ok: r.ok, error: r.ok ? undefined : r.error };
    }

    case "CAPTURE_RESUME": {
      const resumeCode =
        isRecord(raw.payload) && typeof raw.payload.meetingCode === "string"
          ? raw.payload.meetingCode
          : "";
      if (!resumeCode) return { ok: false, error: "no_meeting_code" };
      const r = await gmeetResumeSession(resumeCode);
      await mirrorAppState(resumeCode);
      return { ok: r.ok, error: r.ok ? undefined : r.error };
    }

    case "SYNC_WITH_APP": {
      // The content script knows which Meet it is in; the mirror needs that to
      // tell "Miting is recording *this* call" from "Miting is busy elsewhere".
      // The answer goes back to the asking tab, which decides for itself.
      const code =
        isRecord(raw.payload) && typeof raw.payload.meetingCode === "string"
          ? raw.payload.meetingCode
          : "";
      const state = code ? await mirrorAppState(code) : null;
      return { ok: true, state };
    }

    case "REQUEST_SERVICE_HEALTH": {
      const parsed = extensionMessageSchema.safeParse(raw);
      const ensureTray =
        parsed.success && parsed.data.type === "REQUEST_SERVICE_HEALTH"
          ? parsed.data.payload.ensureTray === true
          : false;
      await refreshServiceHealth(ensureTray);
      const session = await getSessionState();
      return { ok: true, session };
    }

    case "REQUEST_CURRENT_MEETING": {
      const session = await getSessionState();
      const [firstCapture] = await listTabCaptures();
      const activeCapture = firstCapture
        ? { tabId: firstCapture.tabId, sessionId: firstCapture.sessionId, hasAudio: false }
        : null;
      const sessionId = session.currentSessionId ?? activeCapture?.sessionId ?? null;
      let nativeStatus: unknown = null;
      let transcriptReadiness: CurrentMeetingSnapshot["transcriptReadiness"] = sessionId
        ? "loading"
        : "none";
      if (sessionId) {
        const status = await serviceClient.getSessionStatus(sessionId);
        if (status.ok) {
          nativeStatus = status.data;
          transcriptReadiness = readinessFromNativeStatus(status.data);
        } else {
          transcriptReadiness = "failed";
          nativeStatus = { error: status.error };
        }
      }
      const snapshot: CurrentMeetingSnapshot = {
        ...session,
        activeCapture,
        nativeStatus,
        transcriptReadiness,
      };
      return { ok: true, currentMeeting: snapshot };
    }

    case "REQUEST_RECORDINGS_LIST": {
      const parsed = extensionMessageSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "REQUEST_RECORDINGS_LIST") {
        return { ok: false, error: "Invalid recordings list payload" };
      }
      const result = await serviceClient.listRecordings(parsed.data.payload);
      return { ok: result.ok, result };
    }

    case "REQUEST_RECORDING_TRANSCRIPT": {
      const parsed = extensionMessageSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "REQUEST_RECORDING_TRANSCRIPT") {
        return { ok: false, error: "Invalid recording transcript payload" };
      }
      const result = await serviceClient.getRecordingTranscript(parsed.data.payload.sessionId);
      return { ok: result.ok, result };
    }

    case "REQUEST_RECORDING_AUDIO_INFO": {
      const parsed = extensionMessageSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "REQUEST_RECORDING_AUDIO_INFO") {
        return { ok: false, error: "Invalid recording audio payload" };
      }
      const result = await serviceClient.getRecordingAudioInfo(parsed.data.payload.sessionId);
      return { ok: result.ok, result };
    }

    case "REQUEST_RECORDING_AUDIO_CHUNK": {
      const parsed = extensionMessageSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "REQUEST_RECORDING_AUDIO_CHUNK") {
        return { ok: false, error: "Invalid recording audio chunk payload" };
      }
      const { sessionId, offset, length } = parsed.data.payload;
      const result = await serviceClient.getRecordingAudioChunk(sessionId, offset, length);
      return { ok: result.ok, result };
    }

    case "REQUEST_ENGINE_STATUS": {
      const result = await serviceClient.getEngineStatus();
      return { ok: true, result };
    }

    case "REQUEST_CODEX_STATUS": {
      const result = await serviceClient.getCodexStatus();
      return { ok: true, result };
    }

    case "ENGINE_INSTALL": {
      const result = await serviceClient.postEngineInstall();
      return { ok: true, result };
    }

    case "ENGINE_MODEL_DOWNLOAD": {
      const pl = isRecord(raw.payload) ? raw.payload : {};
      const modelName = typeof pl.modelName === "string" ? pl.modelName.trim() : "";
      if (!modelName) {
        return { ok: false, error: "modelName is required" };
      }
      const result = await serviceClient.postEngineModelDownload(modelName);
      return { ok: true, result };
    }

    case "CODEX_LOGIN": {
      let startResult = await serviceClient.postCodexLoginStart();

      // Auto-recover from stale OAuth lock left by a previous incomplete login
      if (!startResult.ok && startResult.error === "login_already_in_progress") {
        console.info("[MCS:bg] clearing stale OAuth lock and retrying login_start");
        await serviceClient.postCodexResetLogin();
        startResult = await serviceClient.postCodexLoginStart();
      }

      if (!startResult.ok) {
        return { ok: false, error: startResult.error ?? "login_start_failed" };
      }
      // Codex CLI opens the browser itself; auth_url is only present with
      // transports that need us to open the sign-in tab.
      const data = startResult.data as { auth_url?: string | null } | undefined;
      const authUrl = data?.auth_url;
      if (typeof authUrl === "string" && authUrl.length > 0) {
        await chrome.tabs.create({ url: authUrl });
      }
      return { ok: true, polling: true };
    }

    case "CODEX_DISCONNECT": {
      const result = await serviceClient.postCodexDisconnect();
      return { ok: result.ok, result };
    }

    case "CAPTURE_START": {
      // Route the click to ONE Meet tab's coordinator. This used to raise a
      // global capture flag that every Meet tab obeyed — see mirrorAppState.
      const payloadMeetTabId =
        isRecord(raw.payload) && typeof raw.payload.meetTabId === "number"
          ? (raw.payload.meetTabId as number)
          : undefined;
      let meetTabId = payloadMeetTabId ?? sender.tab?.id;
      if (meetTabId === undefined) {
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
          url: "https://meet.google.com/*",
        });
        meetTabId = tab?.id;
      }
      if (meetTabId === undefined) return { ok: false, error: "no_meet_tab" };
      ++captureGeneration;
      await chrome.storage.local.remove("mcs_awaiting_capture_click");
      await chrome.tabs
        .sendMessage(meetTabId, { type: "CAPTURE_TAB_START" })
        .catch(() => undefined);
      return { ok: true };
    }

    case "CAPTURE_STOP":
    case "CAPTURE_STOP_WITH_PREFETCH":
    case "EMERGENCY_STOP": {
      // Stop every tab that actually holds a session — normally exactly one.
      ++captureGeneration;
      const captures = await listTabCaptures();
      const targets = captures.length
        ? captures.map((c) => c.tabId)
        : sender.tab?.id !== undefined
          ? [sender.tab.id]
          : [];
      for (const tabId of targets) {
        await chrome.tabs.sendMessage(tabId, { type: "CAPTURE_TAB_STOP" }).catch(() => undefined);
      }
      if (raw.type === "EMERGENCY_STOP") {
        await patchSessionState({
          isCaptureRunning: false,
          recordingTabId: null,
          lastError: "Emergency stop requested",
          captureRecordingAccumMs: 0,
          captureRecordingSegmentStartedAt: null,
        });
      }
      return { ok: true };
    }

    case "CAPTION_LANGUAGE_CHANGED": {
      const pl = isRecord(raw.payload) ? raw.payload : {};
      const language = liveCaptionLanguageSchema.safeParse(pl.language);
      if (!language.success) {
        return { ok: false, error: "Invalid caption language" };
      }
      await setLastCaptionLanguage(language.data);
      await patchSessionState({ currentLiveCaptionLanguage: language.data });
      return { ok: true };
    }

    case "INGEST_SESSION_START": {
      assertMeetSender(sender);
      const parsed = extensionMessageSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "INGEST_SESSION_START") {
        return { ok: false, error: "invalid_payload" };
      }
      const p = parsed.data.payload;
      const settings = await getSettings();
      const mv = chrome.runtime.getManifest();
      const whisperModel = settings.whisperPreferredModel.trim().toLowerCase();
      const knownModels = ["tiny", "base", "small", "medium", "large", "large-v3"];
      const whisper_model_filename = knownModels.includes(whisperModel)
        ? `ggml-${whisperModel === "large" ? "large-v3" : whisperModel}.bin`
        : null;
      const body: SessionStartRequest = {
        session_id: p.sessionId,
        meeting_url: p.meetingUrl,
        meeting_code: p.meetingCode,
        meeting_title: p.meetingTitle,
        started_at: new Date().toISOString(),
        live_caption_language: p.liveCaptionLanguage,
        extension_version: mv.version ?? "0.0.0",
        raw_root_path: settings.rawStorageRoot.trim(),
        final_root_path: settings.finalOutputRoot.trim(),
        codex_merge_enabled: settings.codexMergeEnabled,
        whisper_model_filename,
      };
      // Miting: send to the desktop app's gmeet ingest server over HTTP.
      // We adopt miting's meeting_id as our session id so every subsequent
      // caption/participant/end event carries it directly (no id mapping).
      const result = await gmeetStartSession(body);
      if (!result.ok) {
        return { ok: false, error: result.error, detail: result };
      }
      // Miting owns the recorder and can decline — it is already recording
      // something else, or another Meet. Surface its reason instead of
      // pretending a session started; captions with no recording behind them
      // are worse than a visible refusal.
      if (result.data?.admitted === false) {
        const reason = result.data.reason ?? "Miting declined to record this meeting.";
        // lastError only: flipping the shared capture flag on a refusal is a
        // write about ANOTHER tab's recording, which no refusal may touch.
        await patchSessionState({ lastError: reason });
        return { ok: false, error: "refused_by_app", reason };
      }
      const meetingId = result.data?.meeting_id ?? p.sessionId;
      const resumed = result.data?.resumed === true;
      if (sender.tab?.id !== undefined) {
        await rememberTabCapture(sender.tab.id, {
          sessionId: meetingId,
          meetingCode: p.meetingCode ?? "",
        });
      }
      // The one writer of the shared UI state on a start: this handler knows
      // the tab, the session, and the title, and it runs exactly once per
      // admitted start.
      await patchSessionState({
        isCaptureRunning: true,
        recordingTabId: sender.tab?.id ?? null,
        currentSessionId: meetingId,
        currentMeetingTitle: p.meetingTitle,
        isSessionPaused: false,
        lastError: null,
      });
      return {
        ok: true,
        resumed,
        session_id: meetingId,
        // Where per-block numbering continues for this session, from the rows
        // the server already holds — numbering a rejoin from 1 overwrote them.
        next_block_seq: result.data?.next_block_seq ?? null,
      };
    }

    case "INGEST_CAPTION_EVENT": {
      assertMeetSender(sender);
      const parsed = extensionMessageSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "INGEST_CAPTION_EVENT") {
        return { ok: false, error: "invalid_payload" };
      }
      const { sessionId, body } = parsed.data.payload;
      // The id travels verbatim: the server issued it to that very tab at
      // start. Every "resolve against a stored slot" scheme eventually stamped
      // one meeting's captions with another meeting's id.
      const result = await gmeetSendCaption(sessionId, body);
      if (!result.ok) {
        return { ok: false, error: result.error, detail: result };
      }
      return { ok: true };
    }

    case "INGEST_PARTICIPANT_SNAPSHOT": {
      assertMeetSender(sender);
      const parsed = extensionMessageSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "INGEST_PARTICIPANT_SNAPSHOT") {
        return { ok: false, error: "invalid_payload" };
      }
      const { sessionId, body } = parsed.data.payload;
      const result = await gmeetSendParticipants(sessionId, body);
      if (!result.ok) {
        return { ok: false, error: result.error, detail: result };
      }
      return { ok: true };
    }

    case "INGEST_SESSION_PAUSE": {
      assertMeetSender(sender);
      const parsed = extensionMessageSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "INGEST_SESSION_PAUSE") {
        return { ok: false, error: "invalid_payload" };
      }
      // Miting: meet closed/paused → tell miting to pause recording and
      // start its 5-minute grace window (resume-able, or finalize on expiry).
      const { sessionId: pauseSessionId } = parsed.data.payload;
      const result = await gmeetPauseSession(pauseSessionId);
      if (!result.ok) {
        return { ok: false, error: result.error, detail: result };
      }
      await forgetSession(pauseSessionId);
      await patchSessionState({
        isCaptureRunning: false,
        recordingTabId: null,
        currentSessionId: null,
        isSessionPaused: true,
      });
      return { ok: true };
    }

    case "INGEST_SESSION_END": {
      assertMeetSender(sender);
      const parsed = extensionMessageSchema.safeParse(raw);
      if (!parsed.success || parsed.data.type !== "INGEST_SESSION_END") {
        return { ok: false, error: "invalid_payload" };
      }
      const { sessionId } = parsed.data.payload;
      const result = await gmeetEndSession(sessionId);
      if (!result.ok) {
        return { ok: false, error: result.error, detail: result };
      }
      await forgetSession(sessionId);
      await patchSessionState({
        isCaptureRunning: false,
        recordingTabId: null,
        currentSessionId: null,
        currentMeetingTitle: null,
        isSessionPaused: false,
      });
      return { ok: true };
    }

    case "OPEN_OPTIONS_PAGE": {
      void chrome.runtime.openOptionsPage();
      return { ok: true };
    }

    // Start the desktop app via the native host — Chrome spawns the host even
    // when the app is closed, and the host launches its sibling Miting binary.
    case "REQUEST_APP_LAUNCH": {
      const r = await nativeHostRequest(10_000, "app.launch", {});
      if (!r.ok) {
        return { ok: false, error: r.error };
      }
      return { ok: true, data: r.data };
    }

    default:
      return { ok: false, error: `Unhandled type: ${raw.type}` };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await ensureDefaultSettingsPersisted();
    // 1 min is Chrome's floor for alarms; the content script polls faster
    // while a capture is actually running (see APP_SYNC_MS).
    chrome.alarms.create(HEALTH_ALARM, { periodInMinutes: 1 });
    await refreshServiceHealth();
    const session = await getSessionState();
    await setBadgeRecording(
      session.isCaptureRunning,
      session.recordingTabId ?? undefined,
    );
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshServiceHealth();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEALTH_ALARM) {
    void refreshServiceHealth();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then(sendResponse)
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : "Handler error";
      sendResponse({ ok: false, error: msg });
    });
  return true;
});

/** Content script holds this port open while tab audio records — keeps MV3 SW + offscreen alive. */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "mcs-audio-session") {
    console.info("[MCS:bg] audio keep-alive port connected");
    port.onDisconnect.addListener(() => {
      console.info("[MCS:bg] audio keep-alive port disconnected");
    });
  }
});

/**
 * Safety net: when the Meet tab is closed, pause the session instead of
 * finalizing it. The server-side watchdog will auto-finalize after the grace
 * period (5 min) if the user doesn't rejoin the same meeting.
 *
 * If the content script's teardown already sent INGEST_SESSION_PAUSE and
 * cleared activeCapture, this is a no-op.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const session = await getSessionState();
    if (session.recordingTabId === tabId) {
      await patchSessionState({ isCaptureRunning: false, recordingTabId: null });
    }

    // Only the session THIS tab held is paused. The old single-slot capture
    // meant closing any Meet tab could pause whichever session the slot
    // happened to name.
    const capture = await takeTabCapture(tabId);
    if (capture) {
      console.info(
        `[MCS:bg] Meet tab ${tabId} closed — pausing session ${capture.sessionId} (watchdog will finalize)`,
      );
      void pauseSessionFromBackground(capture);
    }
  })();
});

void ensureDefaultSettingsPersisted().then(() => refreshServiceHealth());


// The one badge writer: render from session state, never from a handler. Five
// call sites each setting the badge is how "REC" survived a refused start.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEYS.session]) return;
  void (async () => {
    const session = await getSessionState();
    await setBadgeRecording(session.isCaptureRunning, session.recordingTabId ?? undefined);
  })();
});

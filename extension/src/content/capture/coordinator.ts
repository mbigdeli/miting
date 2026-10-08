import type { ExtensionMessage } from "../../shared/messages.js";
import { extractMeetingCode } from "../../shared/meetUtils.js";
import {
  getCaptureSegmentState,
  getLastCaptionLanguage,
  getSessionState,
  getSettings,
  patchSessionState,
  setCaptureSegmentState,
} from "../../shared/storage.js";
import { STORAGE_KEYS } from "../../shared/storageKeys.js";
import type { CaptureSegmentState } from "../../shared/types.js";
import { captionBlocks, findCaptionRegion, parseCaptionBlock } from "./caption-parser.js";
import { decideCapture, type AppStateLite } from "./capture-decision.js";
import { CaptionBlockTracker } from "./caption-blocks.js";
import { flushCaptureRecordingSegment, isOkResponse, normalizeMeetingTitle } from "./coordinatorUtils.js";
import { extractParticipants } from "./participants.js";
import { showMeetNotice } from "./meet-notice.js";
import { StealthCaptionManager } from "./stealth-captions.js";

/**
 * How long to wait between attempts to find the caption region after capture
 * starts. Meet renders the region lazily (only after captions are turned on),
 * so we retry at this interval until the region appears.
 */
const REGION_SEARCH_INTERVAL_MS = 3_000;

/**
 * Maximum number of times to attempt finding the caption region before giving
 * up. 100 × 3 s = 5 minutes — long enough to cover any meeting preamble.
 */
const REGION_SEARCH_MAX_ATTEMPTS = 100;
/** Cadence after the first five minutes — rare, but never zero. */
const REGION_SEARCH_SLOW_INTERVAL_MS = 15_000;

/**
 * Debounce delay applied to MutationObserver callbacks. Rapid DOM mutations
 * (individual characters being appended to an active utterance) are collapsed
 * into one flush call so we don't hammer the network on every keyframe.
 */
const CAPTION_DEBOUNCE_MS = 200;

const PARTICIPANT_POLL_MS = 45_000;

/**
 * How often the Meet page asks the background to re-check Miting. Chrome's
 * alarm floor (1 min) is far too coarse; 5s keeps the toolbar within one
 * breath of the app without meaningful localhost traffic.
 */
const APP_SYNC_MS = 5_000;
/** Post the line being spoken this often, so the app shows it live. */
const LIVE_FLUSH_MS = 3_000;
/**
 * Ignore a "not capturing" mirror this soon after our own successful start.
 * A state poll can be computed before session_start lands and applied after,
 * and acting on that one stale answer tore the capture down and restarted it
 * within the same second — two sessions, twice the confusion.
 */
const STALE_MIRROR_GRACE_MS = 8_000;

export function mirrorFalseIsStale(lastStartAt: number, now: number): boolean {
  return now - lastStartAt < STALE_MIRROR_GRACE_MS;
}

/**
 * Meet navigates meeting-to-meeting inside one tab (SPA): no pagehide, no new
 * content script. Without noticing, the coordinator kept its old session id
 * and posted the NEW meeting's captions under it — "a piece of B's transcript
 * sitting in A's meeting" was exactly this.
 */
export function meetChangedInPlace(
  running: boolean,
  activeCode: string | null,
  currentCode: string | null,
): boolean {
  return running && activeCode !== null && currentCode !== null && activeCode !== currentCode;
}

/**
 * Is this content script still attached to a live extension?
 *
 * Reloading an unpacked extension does not stop the content scripts already
 * running in open tabs; it orphans them. `chrome.runtime.id` is the documented
 * tell — it becomes undefined — and every `sendMessage` after that throws
 * "Extension context invalidated". Without this check that surfaced as
 * "Miting could not start recording this meeting", which sent people looking
 * at the app, the pairing and the microphone when the fix was to reload the
 * tab.
 */
export function extensionContextAlive(): boolean {
  return Boolean(chrome.runtime?.id);
}

export class MeetCaptureCoordinator {
  private running = false;
  private starting = false;
  private sessionId: string | null = null;
  private seq = 0;
  private audioSegmentIndex = 0;
  private audioRunning = false;
  /**
   * Long-lived port keeps the MV3 service worker (and its offscreen document)
   * alive while tab audio is recording. Without this, Chrome idles the SW after
   * ~30s, which tears down offscreen and the MediaRecorder — STOP then yields
   * an empty blob and no file is saved.
   */
  private audioKeepAlivePort: chrome.runtime.Port | null = null;

  private captionObserver: MutationObserver | null = null;
  private captionRegion: Element | null = null;
  private regionSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private captionDebounce: ReturnType<typeof setTimeout> | null = null;
  private participantTimer: ReturnType<typeof setInterval> | null = null;
  private appSyncTimer: ReturnType<typeof setInterval> | null = null;
  private lastStartAt = 0;
  private activeMeetingCode: string | null = null;
  /**
   * An auto-start the app refused. Cleared by an explicit click or by moving
   * to a different meeting — retrying on a timer is what stacked refusal
   * toasts three deep in the app.
   */
  private refusedAutoStart = false;

  private blocks = new CaptionBlockTracker();

  private stealthCaptions: StealthCaptionManager | null = null;

  constructor(private readonly doc: Document) {}

  private openAudioKeepAlive(): void {
    this.closeAudioKeepAlive();
    try {
      this.audioKeepAlivePort = chrome.runtime.connect({ name: "mcs-audio-session" });
      this.audioKeepAlivePort.onDisconnect.addListener(() => {
        this.audioKeepAlivePort = null;
      });
      console.info("[MCS] audio keep-alive port open (service worker + offscreen stay alive)");
    } catch (e) {
      console.warn("[MCS] audio keep-alive connect failed:", e);
    }
  }

  private closeAudioKeepAlive(): void {
    if (this.audioKeepAlivePort) {
      try {
        this.audioKeepAlivePort.disconnect();
      } catch {
        /* ignore */
      }
      this.audioKeepAlivePort = null;
      console.info("[MCS] audio keep-alive port closed");
    }
  }

  async start(): Promise<void> {
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
    window.addEventListener("pagehide", this.onPageHide);
    // Ask about the app for as long as this Meet page lives, and act ONLY on
    // the answer for this tab's own meeting code. Capture used to follow a
    // global isCaptureRunning flag shared by every Meet tab; two open Meets
    // then took turns flipping it and ending each other's sessions.
    this.appSyncTimer = setInterval(() => void this.syncTick(), APP_SYNC_MS);
    void this.syncTick();
  }

  private readonly onPageHide = (): void => {
    void this.teardown("pagehide");
  };

  private readonly onRuntimeMessage = (msg: unknown): void => {
    if (typeof msg !== "object" || msg === null || !("type" in msg)) {
      return;
    }
    // Targeted at THIS tab by the background (popup buttons) — never a
    // broadcast that every Meet tab obeys at once.
    const t = (msg as { type: string }).type;
    if (t === "CAPTURE_TAB_START") {
      void this.userStart();
    } else if (t === "CAPTURE_TAB_STOP") {
      void this.userStop();
    }
  };

  /** An explicit click: always allowed to ask, even after a refusal. */
  async userStart(): Promise<boolean> {
    this.refusedAutoStart = false;
    return this.beginCapture();
  }

  async userStop(): Promise<void> {
    await this.teardown("stop_flag");
  }

  isCapturing(): boolean {
    return this.running;
  }

  private async syncTick(): Promise<void> {
    const code = extractMeetingCode(this.doc.location.href);
    if (!code) return;
    if (meetChangedInPlace(this.running, this.activeMeetingCode, code)) {
      console.info(
        `[MCS] meet changed in place (${this.activeMeetingCode} -> ${code}): rotating the session`,
      );
      this.refusedAutoStart = false;
      // Teardown pauses the OLD session on the server (grace opens), and the
      // fresh beginCapture starts the NEW one — the app hands over.
      void this.teardown("url_changed").then(() => this.beginCapture());
      return;
    }
    const res = await chrome.runtime
      .sendMessage({ type: "SYNC_WITH_APP", payload: { meetingCode: code } })
      .catch(() => null);
    const state =
      typeof res === "object" && res !== null && "state" in res
        ? ((res as { state: AppStateLite | null }).state ?? null)
        : null;
    if (!state) return;
    const action = decideCapture({
      running: this.running,
      starting: this.starting,
      myCode: code,
      state,
      autoStart: (await getSettings()).autoStartCaptureWhenMeetDetected,
      refusedAutoStart: this.refusedAutoStart,
      startedJustNow: mirrorFalseIsStale(this.lastStartAt, Date.now()),
    });
    if (action === "begin") {
      await this.beginCapture();
    } else if (action === "teardown_paused") {
      await this.teardown("app_paused");
    } else if (action === "teardown_stop") {
      await this.teardown("app_stopped");
    }
  }

  /** Returns true when a capture is (now) running for this tab. */
  private async beginCapture(): Promise<boolean> {
    if (this.running) {
      return true;
    }
    if (this.starting) {
      return false;
    }
    this.starting = true;
    try {
      // Reloading an unpacked extension leaves the content script already in
      // the page running against an extension that no longer exists. Every
      // sendMessage then throws "Extension context invalidated", which surfaced
      // as "Miting could not start recording this meeting" — a message that
      // names neither the cause nor the one-key fix.
      if (!extensionContextAlive()) {
        showMeetNotice("Miting was updated. Reload this tab to keep recording.", "blocked");
        this.starting = false;
        return false;
      }
      const settings = await getSettings();
      // Miting: no raw/final storage roots needed — miting owns storage.
      // (The legacy meeting-capture gate checked those here.)

      await chrome.runtime.sendMessage({ type: "REQUEST_SERVICE_HEALTH", payload: { ensureTray: true } });
      const healthSession = await getSessionState();
      if (
        healthSession.localServiceStatus !== "connected" &&
        healthSession.localServiceStatus !== "tray_starting"
      ) {
        showMeetNotice("Miting desktop app is not reachable. Open Miting once, then try again.", "error");
        await patchSessionState({
          lastError: "Miting desktop app is not reachable. Open Miting once, then try again.",
        });
        return false;
      }

      const meetingCode = extractMeetingCode(this.doc.location.href);
      if (!meetingCode) {
        this.starting = false;
        return false;
      }

      const candidateId = crypto.randomUUID();
      const st = await getSessionState();
      const lang = st.currentLiveCaptionLanguage ?? (await getLastCaptionLanguage());

      const startRes = await chrome.runtime.sendMessage({
        type: "INGEST_SESSION_START",
        payload: {
          sessionId: candidateId,
          meetingUrl: this.doc.location.href,
          meetingCode,
          meetingTitle: normalizeMeetingTitle(this.doc.title || ""),
          liveCaptionLanguage: lang,
        },
      });
      if (!isOkResponse(startRes)) {
        const err =
          typeof startRes === "object" && startRes !== null && "error" in startRes
            ? String((startRes as { error: unknown }).error)
            : "session_start_failed";
        // Miting declines when it is already recording. The click happened
        // here, in Meet, so the reason has to appear here — showing it only as
        // a toast inside the app left this tab silent and the user guessing.
        const refusal =
          typeof startRes === "object" && startRes !== null && "reason" in startRes
            ? String((startRes as { reason: unknown }).reason)
            : null;
        showMeetNotice(
          refusal ?? "Miting could not start recording this meeting.",
          refusal ? "blocked" : "error",
        );
        // A refusal is between the app and THIS tab: remember it locally so
        // the tick stops asking, and leave the shared state alone — flipping
        // the global capture flag here is what tore down the OTHER tab's
        // healthy recording.
        this.refusedAutoStart = true;
        await patchSessionState({
          lastError: refusal ?? `Session start failed: ${err}`,
        });
        return false;
      }

      const resumed =
        typeof startRes === "object" && startRes !== null && "resumed" in startRes
          ? (startRes as { resumed: boolean }).resumed
          : false;
      const actualSessionId =
        typeof startRes === "object" && startRes !== null && "session_id" in startRes
          ? String((startRes as { session_id: string }).session_id)
          : candidateId;

      if (resumed) {
        const segState = await getCaptureSegmentState();
        if (segState && segState.sessionId === actualSessionId) {
          this.seq = segState.seq;
          this.audioSegmentIndex = segState.audioSegmentIndex + 1;
        } else {
          this.seq = 0;
          this.audioSegmentIndex = 0;
        }
        console.info(`[MCS] session resumed: ${actualSessionId} (meeting: ${meetingCode}, seg=${this.audioSegmentIndex})`);
      } else {
        this.seq = 0;
        this.audioSegmentIndex = 0;
        console.info(`[MCS] session started: ${actualSessionId} (meeting: ${meetingCode})`);
      }

      if (!resumed) {
        await patchSessionState({
          captureRecordingAccumMs: 0,
          captureRecordingSegmentStartedAt: null,
        });
      }

      this.sessionId = actualSessionId;
      this.blocks.reset();
      const nextBlockSeq =
        typeof startRes === "object" && startRes !== null && "next_block_seq" in startRes
          ? Number((startRes as { next_block_seq: unknown }).next_block_seq)
          : NaN;
      if (Number.isInteger(nextBlockSeq)) {
        this.blocks.seed(nextBlockSeq);
      }
      // The background's INGEST_SESSION_START handler wrote the shared UI
      // state (session id, title, badge fields) — one writer, and it knows
      // the tab id, which this script does not.
      this.refusedAutoStart = false;

      this.stealthCaptions ??= new StealthCaptionManager(this.doc);
      await this.stealthCaptions.activate();

      // The desktop app records the audio; this extension only ships captions.
      // Nothing to start here, and nothing that can fail and derail a session.
      this.audioRunning = false;

      this.startCaptionWatch();
      this.participantTimer = setInterval(() => void this.flushParticipants(), PARTICIPANT_POLL_MS);
      void this.flushParticipants();
      this.running = true;
      this.lastStartAt = Date.now();
      this.activeMeetingCode = meetingCode;
      await patchSessionState({ captureRecordingSegmentStartedAt: Date.now() });
      return true;
    } finally {
      this.starting = false;
    }
  }

  /**
   * Attaches a MutationObserver to the caption region. If the region is not
   * yet visible (captions off or Meet still loading), polls at
   * REGION_SEARCH_INTERVAL_MS until it appears, up to REGION_SEARCH_MAX_ATTEMPTS.
   *
   * When the observer fires we debounce by CAPTION_DEBOUNCE_MS to collapse
   * rapid character-by-character DOM updates into a single flush call.
   */
  private startCaptionWatch(): void {
    if (this.tryAttachObserver()) {
      return;
    }

    console.info("[MCS] caption region not visible yet: will retry every 3 s (captions may be off)");
    let attempts = 0;
    // Self-rescheduling rather than a fixed interval: the search has to
    // outlive the first few minutes. It used to stop after 100 tries, so
    // turning captions on in minute six meant the rest of the call was never
    // captured — and nothing said so. Polling simply slows down instead,
    // which costs a DOM query a quarter-minute and keeps the session
    // recoverable for as long as it runs. `tryAttachObserver` returns true
    // once capture stops, so teardown ends this on its own.
    const search = (): void => {
      attempts += 1;
      if (this.tryAttachObserver()) {
        this.regionSearchTimer = null;
        return;
      }
      if (attempts === REGION_SEARCH_MAX_ATTEMPTS) {
        console.warn(
          "[MCS] caption region still absent after 5 min: slowing the search, not stopping it",
        );
      }
      const wait =
        attempts >= REGION_SEARCH_MAX_ATTEMPTS
          ? REGION_SEARCH_SLOW_INTERVAL_MS
          : REGION_SEARCH_INTERVAL_MS;
      this.regionSearchTimer = setTimeout(search, wait);
    };
    this.regionSearchTimer = setTimeout(search, REGION_SEARCH_INTERVAL_MS);
  }

  /**
   * Tries to find the caption region and attach a MutationObserver to it.
   * Returns true on success.
   */
  private tryAttachObserver(): boolean {
    if (!this.running && !this.starting) {
      return true; // capture already stopped, abort search
    }
    const region = findCaptionRegion(this.doc);
    if (!region) {
      return false;
    }

    console.info("[MCS] MutationObserver attached to caption region ✓");
    this.captionRegion = region;
    this.captionObserver = new MutationObserver(() => {
      this.scheduleCaptionFlush();
    });
    this.captionObserver.observe(region, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return true;
  }

  /**
   * Schedules a single caption flush after CAPTION_DEBOUNCE_MS. Any further
   * observer callbacks within the window cancel and restart the timer, so
   * only the final state of a rapidly mutating utterance is captured.
   */
  private scheduleCaptionFlush(): void {
    if (this.captionDebounce !== null) {
      clearTimeout(this.captionDebounce);
    }
    this.captionDebounce = setTimeout(() => {
      this.captionDebounce = null;
      void this.flushCaption();
    }, CAPTION_DEBOUNCE_MS);
  }

  /**
   * Sweep EVERY visible caption block and post the ones that changed.
   *
   * Meet revises earlier blocks while later ones grow — a long turn gets its
   * tail rewritten while the next speaker is already on screen. Following
   * only the last block lost those revisions outright (a whole turn once
   * survived as one word). Each block carries a per-session number, the
   * server upserts by it, and the app's live view is keyed by the resulting
   * row — so every visible line grows and corrects in place, live.
   */
  private async flushCaption(): Promise<void> {
    const sid = this.sessionId;
    if (!sid || !this.running) {
      return;
    }
    const region = this.captionRegion;
    if (!region || !region.isConnected) {
      return;
    }
    for (const block of captionBlocks(region)) {
      const { speaker, text } = parseCaptionBlock(block);
      if (text.length < 2) continue;
      const blockSeq = this.blocks.seqFor(block);
      if (!this.blocks.changed(blockSeq, speaker, text)) continue;
      await this.emitCaptionLine(sid, { speaker, text, blockSeq });
    }
  }

  /** Send one caption block's current content to the ingest server. */
  private async emitCaptionLine(
    sid: string,
    line: { speaker: string | null; text: string; blockSeq: number },
  ): Promise<void> {
    this.seq += 1;
    console.info(
      `[MCS] caption #${this.seq} (block ${line.blockSeq}) → speaker="${line.speaker ?? "(none)"}" len=${line.text.length}`,
    );
    const st = await getSessionState();
    const lang = st.currentLiveCaptionLanguage ?? (await getLastCaptionLanguage());
    const source_language_setting = lang === "fa" || lang === "en" ? lang : null;
    const body = {
      captured_at: new Date().toISOString(),
      sequence_number: this.seq,
      caption_text: line.text,
      speaker_hint_text: line.speaker,
      source_language_setting,
      dom_signature: null,
      block_seq: line.blockSeq,
    };
    const r = await chrome.runtime.sendMessage({
      type: "INGEST_CAPTION_EVENT",
      payload: { sessionId: sid, body },
    });
    if (!isOkResponse(r)) {
      const msg =
        typeof r === "object" && r !== null && "error" in r
          ? String((r as { error: unknown }).error)
          : "caption_post_failed";
      console.error(`[MCS] caption upload failed: ${msg}`);
      await patchSessionState({ lastError: `Caption upload: ${msg}` });
    } else {
      console.debug(`[MCS] caption #${this.seq} delivered to local service ✓`);
    }
  }

  private async flushParticipants(): Promise<void> {
    const sid = this.sessionId;
    if (!sid || !this.running) {
      return;
    }
    const participants = extractParticipants(this.doc);
    const body = {
      captured_at: new Date().toISOString(),
      participants,
    };
    const r = await chrome.runtime.sendMessage({
      type: "INGEST_PARTICIPANT_SNAPSHOT",
      payload: { sessionId: sid, body },
    });
    if (!isOkResponse(r)) {
      const msg =
        typeof r === "object" && r !== null && "error" in r
          ? String((r as { error: unknown }).error)
          : "participant_post_failed";
      await patchSessionState({ lastError: `Participant snapshot: ${msg}` });
    }
  }

  async teardown(reason: string): Promise<void> {
    if (!this.running && !this.sessionId) {
      return;
    }
    await flushCaptureRecordingSegment();
    console.info(`[MCS] teardown (reason=${reason}, seq=${this.seq})`);
    this.stealthCaptions?.deactivate();
    this.running = false;
    this.activeMeetingCode = null;
    const hadAudio = this.audioRunning;
    this.audioRunning = false;
    this.doc.getElementById("mcs-capture-badge")?.remove();

    // Held for the final sweep below — the observer teardown clears the field.
    const finalRegion = this.captionRegion;
    if (this.captionObserver) {
      this.captionObserver.disconnect();
      this.captionObserver = null;
    }
    this.captionRegion = null;
    if (this.regionSearchTimer) {
      clearTimeout(this.regionSearchTimer);
      this.regionSearchTimer = null;
    }
    if (this.captionDebounce !== null) {
      clearTimeout(this.captionDebounce);
      this.captionDebounce = null;
    }
    if (this.participantTimer) {
      clearInterval(this.participantTimer);
      this.participantTimer = null;
    }
    if (reason === "pagehide" && this.appSyncTimer) {
      clearInterval(this.appSyncTimer);
      this.appSyncTimer = null;
    }

    const sid = this.sessionId;
    const meetingCode = extractMeetingCode(this.doc.location.href);
    this.sessionId = null;
    if (!sid) {
      // No active session — nothing to flush.
      this.blocks.reset();
      return;
    }

    // One last sweep so the final state of every visible block is stored —
    // the tail of the last utterance used to be lost right here.
    if (finalRegion?.isConnected) {
      for (const block of captionBlocks(finalRegion)) {
        const { speaker, text } = parseCaptionBlock(block);
        if (text.length < 2) continue;
        const blockSeq = this.blocks.seqFor(block);
        if (!this.blocks.changed(blockSeq, speaker, text)) continue;
        await this.emitCaptionLine(sid, { speaker, text, blockSeq });
      }
    }
    this.blocks.reset();

    // Different reasons, different outcomes:
    //   stop_flag    the user stopped      -> end the session
    //   pagehide     they left the Meet    -> pause, opening the grace window
    //   app_paused   Miting paused itself  -> tell the app nothing at all; it
    //   app_stopped  Miting ended itself      already knows, and the messages
    //                                         below would undo it
    if (reason === "app_paused" || reason === "app_stopped") {
      return;
    }
    const endsSession = reason === "stop_flag";
    const pausedAt = new Date().toISOString();
    const pauseRes = await chrome.runtime.sendMessage(
      endsSession
        ? { type: "INGEST_SESSION_END", payload: { sessionId: sid, endedAtIso: pausedAt } }
        : { type: "INGEST_SESSION_PAUSE", payload: { sessionId: sid, pausedAtIso: pausedAt } },
    );
    if (!isOkResponse(pauseRes)) {
      await patchSessionState({
        lastError: `Session pause: ${
          typeof pauseRes === "object" && pauseRes !== null && "error" in pauseRes
            ? String((pauseRes as { error: unknown }).error)
            : "pause_failed"
        }`,
      });
    }

    const segState: CaptureSegmentState = {
      sessionId: sid,
      meetingCode: meetingCode ?? "",
      seq: this.seq,
      audioSegmentIndex: this.audioSegmentIndex,
    };
    await setCaptureSegmentState(segState);

    // Shared UI state (badge, popup, widget) is written by the background's
    // pause/end relays — the one writer that also forgets the tab's session.
  }
}

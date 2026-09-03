import "@material/web/button/filled-tonal-button.js";
import "@material/web/divider/divider.js";
import "@material/web/iconbutton/icon-button.js";

import type { ExtensionMessage, SettingsAndSessionResponse } from "../shared/messages.js";
import { getRecordingElapsedMs } from "../shared/recordingTimer.js";
import { getSessionState, patchSessionState } from "../shared/storage.js";
import type { SessionState } from "../shared/types.js";
import { ensureDesktopAppRunning as ensureAppRunning } from "./appLaunch.js";
import "./popup.css";

const AWAITING_KEY = "mcs_awaiting_capture_click";

type SettingsResponse = { ok: true } & SettingsAndSessionResponse;
type ServiceHealthResponse = { ok: true; session: SessionState };

/** Meeting code from the tab's URL — the key every app call is scoped by. */
function meetingCodeOf(tab: MeetTabInfo): string {
  const m = tab.url.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return m?.[1] ?? tab.title;
}

interface MeetTabInfo {
  tabId: number;
  windowId: number;
  title: string;
  url: string;
}

let durationInterval: ReturnType<typeof setInterval> | null = null;
let busy = false;
const COOLDOWN_MS = 300;
/**
 * Getting the recorder up takes Miting a few seconds. The controls stay locked
 * until its state actually changes, so the card never looks idle while a start
 * is in flight; the timeout only guards against an answer that never comes.
 */
const START_SETTLE_TIMEOUT_MS = 12_000;
const START_POLL_MS = 400;

/** Wait for the mirrored app state to report capture running. */
async function waitForCaptureRunning(): Promise<void> {
  const deadline = Date.now() + START_SETTLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const s = await getSessionState();
    if (s.isCaptureRunning || s.appPhase === "recording") return;
    await new Promise((r) => setTimeout(r, START_POLL_MS));
  }
}

function setBusy(on: boolean, label?: string): void {
  busy = on;
  document.querySelectorAll<HTMLElement>(".meet-tab-card__actions").forEach((el) => {
    el.style.opacity = on ? "0.4" : "";
    el.style.pointerEvents = on ? "none" : "";
  });
  // Say what the wait is for; a dimmed button alone reads as "nothing happened".
  document.querySelectorAll<HTMLElement>("[data-duration]").forEach((el) => {
    if (on && label) {
      el.dataset.prev ??= el.textContent ?? "";
      el.textContent = label;
    } else if (el.dataset.prev !== undefined) {
      el.textContent = el.dataset.prev;
      delete el.dataset.prev;
    }
  });
}

function sendMessage<T>(msg: object): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response as T);
    });
  });
}

function showError(message: string | null): void {
  const el = document.getElementById("err");
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

async function getAllMeetTabs(): Promise<MeetTabInfo[]> {
  try {
    const tabs = await chrome.tabs.query({ url: "https://meet.google.com/*" });
    return tabs
      .filter((t) => t.id !== undefined && t.windowId !== undefined)
      .map((t) => ({
        tabId: t.id!,
        windowId: t.windowId!,
        title: cleanMeetTitle(t.title ?? "Google Meet"),
        url: t.url ?? "",
      }));
  } catch {
    return [];
  }
}

function cleanMeetTitle(raw: string): string {
  return raw
    .replace(/^Meet\s*[-–—]\s*/i, "")
    .replace(/\s*[-–—]\s*Google Meet$/i, "")
    .trim() || "Google Meet";
}

async function getActiveTabId(): Promise<number | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id ?? null;
  } catch {
    return null;
  }
}

function createIcon(name: string, extraClass?: string): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = `material-symbols-outlined${extraClass ? ` ${extraClass}` : ""}`;
  icon.textContent = name;
  return icon;
}

function startDurationUpdater(): void {
  stopDurationUpdater();
  const update = (): void => {
    void (async () => {
      try {
        const session = await getSessionState();
        const els = document.querySelectorAll<HTMLSpanElement>("[data-duration]");
        const elapsed = getRecordingElapsedMs(session);
        const text = formatDuration(elapsed);
        els.forEach((el) => {
          el.textContent = text;
        });
      } catch {
        /* ignore */
      }
    })();
  };
  update();
  durationInterval = setInterval(update, 1000);
}

function stopDurationUpdater(): void {
  if (durationInterval !== null) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
}

function setServiceLabel(text: string): void {
  const label = document.getElementById("svc-label");
  if (label) label.textContent = text;
}

/** Launch the desktop app (if down) and wait for it, using the popup's plumbing. */
function ensureDesktopAppRunning(): Promise<void> {
  return ensureAppRunning({
    fetchSession: async () => {
      try {
        const r = await sendMessage<ServiceHealthResponse>({
          type: "REQUEST_SERVICE_HEALTH",
          payload: {},
        });
        return r.session;
      } catch {
        return null;
      }
    },
    requestLaunch: () =>
      sendMessage<{ ok: boolean; error?: string }>({
        type: "REQUEST_APP_LAUNCH",
        payload: {},
      }),
    setLabel: setServiceLabel,
    onConnected: renderServiceStatus,
  });
}

async function startCapture(tabId: number): Promise<void> {
  if (busy) return;
  setBusy(true, "Starting…");
  try {
    // Desktop app closed? Launch it first so record never dead-ends.
    await ensureDesktopAppRunning();

    const result = await sendMessage<{ ok: boolean; reason?: string }>({
      type: "CAPTURE_START",
      payload: { meetTabId: tabId },
    } satisfies ExtensionMessage);

    // The old "click the extension icon first" hint is gone with tabCapture.
    // What can still fail is Miting declining, and it says why.
    if (!result.ok) {
      showError(result.reason ?? "Could not start recording.");
      return;
    }
    // Hold the controls until Miting is actually recording — releasing after
    // the message returned left the card idle-looking for several seconds.
    await waitForCaptureRunning();
  } finally {
    setBusy(false);
  }
}

async function stopCapture(): Promise<void> {
  if (busy) return;
  setBusy(true);
  try {
    await sendMessage({ type: "CAPTURE_STOP", payload: {} } satisfies ExtensionMessage);
  } finally {
    await new Promise((r) => setTimeout(r, COOLDOWN_MS));
    setBusy(false);
  }
}

function renderMeetTabs(
  container: HTMLElement,
  meetTabs: MeetTabInfo[],
  session: SessionState,
  activeTabId: number | null,
): void {
  container.innerHTML = "";

  if (meetTabs.length === 0) return;

  for (const tab of meetTabs) {
    const isRecording = session.isCaptureRunning && session.recordingTabId === tab.tabId;
    const isPaused = session.appPhase === "paused" && session.recordingTabId === tab.tabId;
    const isActiveTab = tab.tabId === activeTabId;
    const hasTimer = isRecording || isPaused;

    const card = document.createElement("div");
    card.className = "meet-tab-card";
    if (!isActiveTab) card.classList.add("meet-tab-card--clickable");

    // Status dot
    const dot = document.createElement("span");
    dot.className = "meet-tab-card__dot";
    if (isRecording) dot.classList.add("meet-tab-card__dot--recording");
    else if (isPaused) dot.classList.add("meet-tab-card__dot--paused");
    card.appendChild(dot);

    // Info: title + duration
    const info = document.createElement("div");
    info.className = "meet-tab-card__info";
    const title = document.createElement("span");
    title.className = "meet-tab-card__title";
    title.textContent = tab.title;
    info.appendChild(title);

    if (hasTimer) {
      const dur = document.createElement("span");
      dur.className = "meet-tab-card__duration";
      dur.setAttribute("data-duration", "");
      dur.textContent = formatDuration(getRecordingElapsedMs(session));
      info.appendChild(dur);
    }
    card.appendChild(info);

    // Actions
    const actions = document.createElement("div");
    actions.className = "meet-tab-card__actions";

    if (isActiveTab) {
      if (isRecording) {
        const pauseBtn = document.createElement("md-icon-button");
        pauseBtn.className = "meet-tab-action--pause";
        pauseBtn.setAttribute("aria-label", "Pause recording");
        pauseBtn.appendChild(createIcon("pause"));
        pauseBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (busy) return;
          void (async () => {
            try {
              // Relay to Miting; the mirror renders whatever it decides. This
              // used to call stopCapture(), which ended the session — the one
              // button in the product where "pause" meant "stop".
              await sendMessage({
                type: "CAPTURE_PAUSE",
                payload: { meetingCode: meetingCodeOf(tab) },
              } satisfies ExtensionMessage);
              await refresh();
            }
            catch (err) { showError(err instanceof Error ? err.message : "Failed to pause"); }
          })();
        });
        actions.appendChild(pauseBtn);
      }
      else if (isPaused) {
        const resumeBtn = document.createElement("md-icon-button");
        resumeBtn.className = "meet-tab-action--resume";
        resumeBtn.setAttribute("aria-label", "Resume recording");
        resumeBtn.appendChild(createIcon("play_arrow"));
        resumeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (busy) return;
          void (async () => {
            try {
              await sendMessage({
                type: "CAPTURE_RESUME",
                payload: { meetingCode: meetingCodeOf(tab) },
              } satisfies ExtensionMessage);
              await refresh();
            }
            catch (err) { showError(err instanceof Error ? err.message : "Failed to resume"); }
          })();
        });
        actions.appendChild(resumeBtn);
      }
      else {
        const recordBtn = document.createElement("md-icon-button");
        recordBtn.className = "meet-tab-action--record";
        recordBtn.setAttribute("aria-label", "Start recording");
        recordBtn.appendChild(createIcon("fiber_manual_record"));
        recordBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (busy) return;
          void (async () => {
            try {
              await startCapture(tab.tabId); // Starts capture for the selected Meet tab
              await refresh(); // Refreshes popup state/UI after capture starts
            }
            catch (err) { showError(err instanceof Error ? err.message : "Failed to start"); }
          })();
        });
        actions.appendChild(recordBtn);
      }
    } else {
      if (isRecording) {
        const chip = document.createElement("span");
        chip.className = "meet-tab-chip meet-tab-chip--recording";
        chip.textContent = "REC";
        actions.appendChild(chip);
      } else if (isPaused) {
        const chip = document.createElement("span");
        chip.className = "meet-tab-chip meet-tab-chip--paused";
        chip.textContent = "PAUSED";
        actions.appendChild(chip);
      }
      actions.appendChild(createIcon("chevron_right", "meet-tab-arrow"));
    }

    card.appendChild(actions);

    if (!isActiveTab) {
      card.addEventListener("click", () => {
        void chrome.tabs.update(tab.tabId, { active: true });
        void chrome.windows.update(tab.windowId, { focused: true });
        window.close();
      });
    }

    container.appendChild(card);
  }
}

function renderServiceStatus(session: SessionState): void {
  const dot = document.getElementById("svc-dot");
  const label = document.getElementById("svc-label");
  const launchBtn = document.getElementById("svc-launch") as HTMLButtonElement | null;
  if (!dot || !label) return;

  dot.className = "popup-footer__dot";
  let appDown = false;

  switch (session.localServiceStatus) {
    case "connected":
      dot.classList.add("popup-footer__dot--connected");
      label.textContent = "Desktop app connected";
      break;
    case "tray_starting":
      dot.classList.add("popup-footer__dot--connected");
      label.textContent = "Tray starting";
      break;
    case "tray_stopped":
      dot.classList.add("popup-footer__dot--error");
      label.textContent = "Tray stopped";
      appDown = true;
      break;
    case "unavailable":
    case "timeout":
    case "error":
      dot.classList.add("popup-footer__dot--error");
      label.textContent = "Desktop app unavailable";
      appDown = true;
      break;
    case "unhealthy":
      dot.classList.add("popup-footer__dot--error");
      label.textContent = "Desktop app unhealthy";
      appDown = true;
      break;
    default:
      label.textContent = "Checking service…";
      break;
  }

  if (launchBtn && !launchBtn.disabled) {
    launchBtn.hidden = !appDown;
  }
}


async function refresh(): Promise<void> {
  showError(null);
  try {
    await sendMessage<ServiceHealthResponse>({
      type: "REQUEST_SERVICE_HEALTH",
      payload: {},
    });

    const data = await sendMessage<SettingsResponse>({
      type: "REQUEST_SETTINGS",
      payload: {},
    });
    if (!data.ok) {
      showError("Failed to load extension state.");
      return;
    }

    const { session } = data;
    const meetTabs = await getAllMeetTabs();
    // Opening the popup is the user looking: sync with the app now instead of
    // rendering whatever the last 5s poll happened to see.
    const popupActiveTabId = await getActiveTabId();
    const activeMeet = meetTabs.find((t) => t.tabId === popupActiveTabId) ?? meetTabs[0];
    if (activeMeet) {
      await sendMessage({
        type: "SYNC_WITH_APP",
        payload: { meetingCode: meetingCodeOf(activeMeet) },
      } satisfies ExtensionMessage).catch(() => undefined);
    }
    const activeTabId = await getActiveTabId();

    const container = document.getElementById("meet-tabs-container");
    const emptyState = document.getElementById("empty-state");

    let displaySession = session;
    if (!session.isCaptureRunning && session.appPhase !== "paused") {
      if (session.captureRecordingAccumMs > 0 || session.captureRecordingSegmentStartedAt != null) {
        await patchSessionState({
          captureRecordingAccumMs: 0,
          captureRecordingSegmentStartedAt: null,
        });
        displaySession = await getSessionState();
      }
    }

    if (container) {
      renderMeetTabs(container, meetTabs, displaySession, activeTabId);
    }

    if (emptyState) {
      emptyState.hidden = meetTabs.length > 0;
    }

    if (displaySession.isCaptureRunning || displaySession.isSessionPaused) {
      startDurationUpdater();
    } else {
      stopDurationUpdater();
    }

    renderServiceStatus(displaySession);
    renderAudioError(displaySession);
  } catch (e) {
    showError(e instanceof Error ? e.message : "Unknown error");
  }
}

/**
 * Surface a recording that is capturing captions but no audio.
 *
 * Miting keeps such a session running on purpose, so nothing stops and nothing
 * else says anything — and the user is on the Meet tab, not in the app. The
 * button opens Miting, where the microphone can be picked from the banner
 * waiting there.
 */
function renderAudioError(session: SessionState): void {
  const el = document.getElementById("err");
  if (!el) return;
  const message = session.lastError;
  if (!message || !/microphone/i.test(message)) return;

  el.hidden = false;
  el.textContent = "";
  el.append(message, " ");

  const open = document.createElement("button");
  open.type = "button";
  open.className = "popup-error__action";
  open.textContent = "Open Miting to fix";
  open.addEventListener("click", () => {
    // The same path the footer uses to start Miting; the native host is spawned
    // by Chrome even when the app is closed, and focuses it when it is open.
    void sendMessage<{ ok: boolean; error?: string }>({
      type: "REQUEST_APP_LAUNCH",
      payload: {},
    }).catch(() => undefined);
  });
  el.append(open);
}

/**
 * Auto-start: if the popup was opened because the user clicked the extension
 * icon after FLASH_BADGE told them to, start capture immediately.
 */
async function tryAutoStart(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(AWAITING_KEY);
    const awaiting = stored[AWAITING_KEY] as { tabId: number; ts: number } | undefined;
    if (!awaiting || Date.now() - awaiting.ts > 60_000) return false;

    await chrome.storage.local.remove(AWAITING_KEY);

    const session = await sendMessage<ServiceHealthResponse>({
      type: "REQUEST_SESSION_STATUS",
      payload: {},
    });
    if (session.session.isCaptureRunning) return false;

    await startCapture(awaiting.tabId);
    return true;
  } catch {
    return false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────

document.getElementById("svc-launch")?.addEventListener("click", () => {
  const btn = document.getElementById("svc-launch") as HTMLButtonElement | null;
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = "Starting…";
  void (async () => {
    try {
      await ensureDesktopAppRunning();
      btn.hidden = true;
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not start Miting");
    } finally {
      btn.disabled = false;
      btn.textContent = "Open Miting";
      await refresh();
    }
  })();
});

const newMeetBtn = document.getElementById("new-meet");
if (newMeetBtn) {
  newMeetBtn.addEventListener("click", () => {
    void chrome.tabs.create({ url: "https://meet.new" });
    window.close();
  });
  customElements.whenDefined("md-filled-tonal-button").then(() => {
    const inner = newMeetBtn.shadowRoot?.querySelector("button");
    if (inner) inner.style.margin = "0 10px 0 5px";
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: string }).type === "CAPTURE_STATE_CHANGED"
  ) {
    void refresh();
  }
});

void (async () => {
  await tryAutoStart();
  await refresh();
})();

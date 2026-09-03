import type { ExtensionMessage } from "../../shared/messages.js";
import { extractMeetingCode } from "../../shared/meetUtils.js";
import {
  getCaptureSegmentState,
  getLastCaptionLanguage,
  getSessionState,
  getSettings,
  patchSessionState,
  setCaptureSegmentState,
  setLastCaptionLanguage,
} from "../../shared/storage.js";
import { GoogleMeetDomAdapter } from "./adapter.js";
import { createDropdownPanel } from "./dropdown-panel.js";
import { MeetUiController } from "./controller.js";
import { createMeetWidgetHost } from "./widget.js";

const TAG = "[MCS meet-ui]";
const GLOBAL_KEY = "__mcsMeetUiController";
const CAPTURE_TEARDOWN_BRIDGE = "__mcsNotifyCaptureTeardown";
const CAPTURE_START_BRIDGE = "__mcsRequestCaptureStart";
const CAPTURE_RUNNING_BRIDGE = "__mcsIsCapturing";
const HINT_ID = "mcs-capture-hint";

function showCaptureHint(message?: string): void {
  let hint = document.getElementById(HINT_ID);
  if (hint) {
    hint.remove();
  }
  hint = document.createElement("div");
  hint.id = HINT_ID;
  hint.textContent = message ?? "Could not start recording.";
  const s = hint.style;
  s.position = "fixed";
  s.bottom = "80px";
  s.left = "50%";
  s.transform = "translateX(-50%)";
  s.padding = "10px 20px";
  s.borderRadius = "8px";
  s.background = "#202124";
  s.color = "#e8eaed";
  s.fontSize = "13px";
  s.zIndex = "99999";
  s.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
  s.transition = "opacity 0.3s";
  document.body.appendChild(hint);
  setTimeout(() => {
    if (hint) {
      hint.style.opacity = "0";
    }
    setTimeout(() => hint?.remove(), 400);
  }, 4000);
}

type GlobalWindow = Window & typeof globalThis & {
  [GLOBAL_KEY]?: MeetUiController;
  [CAPTURE_TEARDOWN_BRIDGE]?: (reason: string) => Promise<void>;
  [CAPTURE_START_BRIDGE]?: () => Promise<boolean>;
  [CAPTURE_RUNNING_BRIDGE]?: () => boolean;
};

function isActualMeetingRoom(): boolean {
  return extractMeetingCode(window.location.href) !== null;
}

function normalizeMeetingTitle(title: string): string {
  return title.replace(/\s+-\s+Google Meet$/, "").trim();
}

let dropdownPanel: ReturnType<typeof createDropdownPanel> | null = null;
let urlMonitorStarted = false;
let currentUrl = window.location.href;
let titleObserver: MutationObserver | null = null;

function teardownMeetUi(): void {
  const win = window as GlobalWindow;
  if (dropdownPanel) {
    dropdownPanel.destroy();
    dropdownPanel = null;
  }
  const controller = win[GLOBAL_KEY];
  if (controller) {
    console.info(TAG, "tearing down meet UI");
    void controller.stop();
    delete win[GLOBAL_KEY];
  }
}

async function notifyCaptureMeetingEnded(reason: "toolbar_removed" | "url_non_meeting"): Promise<void> {
  const win = window as GlobalWindow;
  // THIS tab's capture, not the global display flag — the flag also reads
  // true while a different tab records, and false must not silence a real
  // teardown here.
  if (win[CAPTURE_RUNNING_BRIDGE]?.() !== true) {
    return;
  }
  const bridge = win[CAPTURE_TEARDOWN_BRIDGE];
  if (bridge) {
    await bridge(reason);
    return;
  }
  await chrome.runtime.sendMessage({
    type: "CAPTURE_STOP",
    payload: {},
  } satisfies ExtensionMessage);
}

function checkUrlChange(): void {
  if (window.location.href === currentUrl) {
    return;
  }
  const oldCode = extractMeetingCode(currentUrl);
  currentUrl = window.location.href;
  const newCode = extractMeetingCode(currentUrl);

  const wasInMeeting = oldCode !== null;
  const isInMeeting = newCode !== null;

  if (wasInMeeting && isInMeeting && oldCode !== newCode) {
    void notifyCaptureMeetingEnded("url_non_meeting").finally(() => {
      teardownMeetUi();
      void bootMeetUi();
    });
  } else if (!wasInMeeting && isInMeeting) {
    void bootMeetUi();
  } else if (wasInMeeting && !isInMeeting) {
    void notifyCaptureMeetingEnded("url_non_meeting").finally(() => {
      teardownMeetUi();
    });
  }
}

function ensureUrlMonitoring(): void {
  if (urlMonitorStarted) {
    return;
  }
  urlMonitorStarted = true;

  window.addEventListener("popstate", checkUrlChange);
  window.addEventListener("hashchange", checkUrlChange);

  const observeTitle = (): void => {
    titleObserver?.disconnect();
    const titleNode = document.querySelector("title");
    titleObserver = new MutationObserver(() => {
      checkUrlChange();
    });
    if (titleNode) {
      titleObserver.observe(titleNode, { childList: true, subtree: true, characterData: true });
    } else {
      titleObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  };
  observeTitle();

  const headMo = new MutationObserver(() => {
    if (document.querySelector("title") !== null) {
      observeTitle();
    }
    checkUrlChange();
  });
  headMo.observe(document.head, { childList: true, subtree: true });

  window.setInterval(checkUrlChange, 2_000);
}

async function bootMeetUi(): Promise<void> {
  const win = window as GlobalWindow;
  if (win[GLOBAL_KEY]) {
    return;
  }
  if (!isActualMeetingRoom()) {
    return;
  }

  try {
    const currentCode = extractMeetingCode(window.location.href);
    const segState = await getCaptureSegmentState();
    if (segState && segState.meetingCode !== currentCode) {
      await patchSessionState({
        isSessionPaused: false,
        captureRecordingAccumMs: 0,
        captureRecordingSegmentStartedAt: null,
      });
      await setCaptureSegmentState(null);
    }

    console.info(TAG, "booting meet UI for", window.location.href);

    const panel = createDropdownPanel(document);
    dropdownPanel = panel;

    let widgetRef: ReturnType<typeof createMeetWidgetHost> | null = null;
    /** A record/pause/resume command is waiting on Miting's answer. */
    let commandInFlight = false;

    const widget = createMeetWidgetHost(document, {
      onRecordToggle: () => {
        // Every command here is a round-trip to Miting, and the button only
        // changes once the app's state comes back. Without this latch the user
        // gets an unchanged button and clicks again, sending a second command
        // that races the first. Ignore clicks until the answer lands.
        if (commandInFlight) return;
        commandInFlight = true;
        widgetRef?.setBusy?.(true);
        // The button means whatever Miting's phase says it means: recording ->
        // pause, paused -> resume, idle -> start. The extension decides
        // nothing; it relays and renders.
        void (async () => {
          try {
            const session = await getSessionState();
            const meetingCode = extractMeetingCode(document.location.href) ?? "";
            // Pause/resume only apply to THIS tab's own capture. Deciding from
            // the global phase let the button in a second Meet tab pause the
            // recording running in the first one.
            const capturingHere = win[CAPTURE_RUNNING_BRIDGE]?.() === true;
            if (capturingHere && session.appPhase === "recording") {
              await chrome.runtime
                .sendMessage({ type: "CAPTURE_PAUSE", payload: { meetingCode } } satisfies ExtensionMessage)
                .catch(() => undefined);
              return;
            }
            if (capturingHere && session.appPhase === "paused") {
              await chrome.runtime
                .sendMessage({ type: "CAPTURE_RESUME", payload: { meetingCode } } satisfies ExtensionMessage)
                .catch(() => undefined);
              return;
            }
            // Start THIS tab's coordinator directly. Sending a global capture
            // flag through the background reached every Meet tab at once — a
            // click here could stop the recording running in another tab.
            const startBridge = win[CAPTURE_START_BRIDGE];
            if (!startBridge) {
              showCaptureHint("Recording is unavailable in this tab — reload it.");
              throw new Error("capture_bridge_missing");
            }
            // Awaited, not callback-style: the old form let `finally` run
            // milliseconds later, so the button unlatched while the app was
            // still spending its 3-4 seconds getting the recorder up.
            const started = await startBridge();
            if (!started) {
              // The coordinator already showed Miting's refusal in this tab;
              // release the button — no state change is coming to release it.
              throw new Error("start_refused");
            }
          } catch {
            // A refusal or a transport failure: release the button now, since
            // no state change is coming to release it.
            widgetRef?.setBusy?.(false);
          } finally {
            commandInFlight = false;
            // Deliberately not clearing the pending look here on success — the
            // widget holds it until Miting's state actually changes, which is
            // the moment the user is waiting for.
          }
        })();
      },
      onDropdownToggle: () => {
        const anchor = document.querySelector<HTMLElement>("[data-mcs-capture-dropdown]");
        if (anchor) {
          panel.toggle(anchor);
        }
      },
      onToolbarRemoved: async () => {
        console.info(TAG, "toolbar removed — stopping capture if running");
        await notifyCaptureMeetingEnded("toolbar_removed");
        teardownMeetUi();
      },
    });
    widgetRef = widget;

    const controller = new MeetUiController({
      adapter: new GoogleMeetDomAdapter(document),
      storage: {
        getSettings,
        getLastCaptionLanguage,
        setLastCaptionLanguage,
        patchSessionState,
      },
      widget,
      getMeetingTitle: () => normalizeMeetingTitle(document.title || ""),
    });

    panel.onLanguageRequested((lang) => {
      void controller.requestLanguageChange(lang);
    });

    void getSessionState().then((s) => {
      panel.update(s, s.currentLiveCaptionLanguage);
    });

    win[GLOBAL_KEY] = controller;
    void controller.start();

    window.addEventListener(
      "pagehide",
      () => {
        teardownMeetUi();
      },
      { once: true },
    );
  } catch (err) {
    console.error(TAG, "boot failed:", err);
  }
}

console.info(TAG, "content script loaded on", window.location.href);
ensureUrlMonitoring();

if (isActualMeetingRoom()) {
  void bootMeetUi();
} else {
  console.info(TAG, "not a meeting room — waiting for SPA navigation");
}

import { MeetCaptureCoordinator } from "./coordinator.js";

const GLOBAL_KEY = "__mcsMeetCaptureCoordinator";

/** Meet UI (separate content bundle) invokes this when the in-call toolbar disappears or SPA leaves a room URL. */
const CAPTURE_TEARDOWN_BRIDGE = "__mcsNotifyCaptureTeardown";
/**
 * The toolbar's record/stop buttons act on THIS tab's coordinator directly.
 * They used to flip a capture flag shared by every Meet tab, which let a
 * click in one tab stop the recording running in another.
 */
const CAPTURE_START_BRIDGE = "__mcsRequestCaptureStart";
const CAPTURE_STOP_BRIDGE = "__mcsRequestCaptureStop";
/** Synchronous: is THIS tab's coordinator capturing right now? */
const CAPTURE_RUNNING_BRIDGE = "__mcsIsCapturing";

type GlobalWindow = Window & typeof globalThis & {
  [GLOBAL_KEY]?: MeetCaptureCoordinator;
  [CAPTURE_TEARDOWN_BRIDGE]?: (reason: string) => Promise<void>;
  [CAPTURE_START_BRIDGE]?: () => Promise<boolean>;
  [CAPTURE_STOP_BRIDGE]?: () => Promise<void>;
  [CAPTURE_RUNNING_BRIDGE]?: () => boolean;
};

function bootCapture(): void {
  const win = window as GlobalWindow;
  if (win[GLOBAL_KEY]) {
    return;
  }
  const coordinator = new MeetCaptureCoordinator(document);
  win[GLOBAL_KEY] = coordinator;
  win[CAPTURE_TEARDOWN_BRIDGE] = (reason: string) => coordinator.teardown(reason);
  win[CAPTURE_START_BRIDGE] = () => coordinator.userStart();
  win[CAPTURE_STOP_BRIDGE] = () => coordinator.userStop();
  win[CAPTURE_RUNNING_BRIDGE] = () => coordinator.isCapturing();
  void coordinator.start();
}

bootCapture();

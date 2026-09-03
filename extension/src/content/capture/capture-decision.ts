/**
 * The one decision a Meet tab ever makes: given what the app just said about
 * MY meeting code, do I begin, keep going, or tear down — and nothing else.
 *
 * This replaces the global `isCaptureRunning` flag as the driver of capture.
 * That flag was one boolean shared by every Meet tab: tab B asking about its
 * own code wrote "false" into it, tab A read the "false" as the user stopping,
 * ended its session, and the two tabs took turns killing each other's
 * recordings. Here the input is the app's answer FOR THIS TAB'S CODE, the
 * output applies to this tab alone, and no other tab can be affected.
 */

export interface AppStateLite {
  /** "idle" | "recording" | "paused" | "grace" */
  phase: string;
  /** True only when the app is recording THIS meeting code, unpaused. */
  companion_should_capture: boolean;
  /** The code the app is recording or holding in grace, if any. */
  meeting_code: string | null;
}

export type CaptureAction =
  | "begin" // start or adopt a session for my code
  | "teardown_paused" // the app paused my recording; stop sweeping, say nothing
  | "teardown_stop" // the app ended my recording; end my session too
  | "none";

export interface DecisionInput {
  running: boolean;
  starting: boolean;
  myCode: string;
  state: AppStateLite;
  /** The user's auto-start setting. */
  autoStart: boolean;
  /** A previous auto-start was refused; only an explicit click clears this. */
  refusedAutoStart: boolean;
  /**
   * True while our own successful start is younger than the mirror could be.
   * A poll computed before session_start landed must not tear it down.
   */
  startedJustNow: boolean;
}

export function decideCapture(input: DecisionInput): CaptureAction {
  const { running, starting, myCode, state, autoStart, refusedAutoStart, startedJustNow } = input;
  const mine = state.companion_should_capture === true;

  if (running) {
    if (mine) return "none";
    if (startedJustNow) return "none";
    // "paused" and "grace" both mean the recorder still holds our session,
    // only not running right now — say nothing and let it be resumed. Only a
    // recorder that has truly moved on (idle, or another meeting) ends us.
    return state.phase === "paused" || state.phase === "grace"
      ? "teardown_paused"
      : "teardown_stop";
  }
  if (starting) return "none";

  // The app already records my code (content script restarted mid-meeting,
  // or the app resumed from its own UI): re-attach.
  if (mine) return "begin";

  // Auto-start asks ONLY when the app could plausibly say yes:
  //   idle              nothing is recording
  //   grace             a finished session's window; mine resumes it, another
  //                     meeting's is a free recorder plus a handover
  //   paused, OTHER code  the grace-handover case: opening a new Meet while
  //                     the old one sits paused means "record the new one" —
  //                     the server finalizes the old session in the background
  // A pause of MY OWN code is the user's explicit pause: auto-starting would
  // resume it against their will. And while the app RECORDS another code we
  // stay silent — asking anyway is what stacked "Already recording" toasts
  // three deep. The user can still ask explicitly from the toolbar; that path
  // bypasses this function.
  const free =
    state.phase === "idle" ||
    state.phase === "grace" ||
    (state.phase === "paused" && state.meeting_code !== myCode);
  if (free && autoStart && !refusedAutoStart) return "begin";

  return "none";
}

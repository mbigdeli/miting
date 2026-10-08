/**
 * Starting the desktop app from the popup.
 *
 * Chrome spawns the native messaging host even when Miting is closed, so
 * `app.launch` can start the app; we then poll the extension's own health
 * check until the ingest server answers.
 */

import type { SessionState } from "../shared/types.js";

const LAUNCH_WAIT_ATTEMPTS = 15;
const LAUNCH_POLL_MS = 2000;

export function serviceIsConnected(session: SessionState): boolean {
  return (
    session.localServiceStatus === "connected" || session.localServiceStatus === "tray_starting"
  );
}

export interface LaunchDeps {
  /** Current service health, or null when the health request itself failed. */
  fetchSession: () => Promise<SessionState | null>;
  /** Ask the background worker to run the native host's `app.launch`. */
  requestLaunch: () => Promise<{ ok: boolean; error?: string }>;
  /** Progress copy for the footer label. */
  setLabel: (text: string) => void;
  /** Called with the session that first reports a healthy app. */
  onConnected: (session: SessionState) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Resolves once the desktop app is reachable. No-op when it is already up;
 * throws with a user-facing message when the launch fails or times out.
 */
export async function ensureDesktopAppRunning(deps: LaunchDeps): Promise<void> {
  const sleep = deps.sleep ?? defaultSleep;

  const session = await deps.fetchSession();
  if (session && serviceIsConnected(session)) return;

  deps.setLabel("Starting Miting…");
  const r = await deps.requestLaunch();
  if (!r.ok) {
    throw new Error(r.error ? `Could not start Miting: ${r.error}` : "Could not start Miting");
  }

  for (let i = 0; i < LAUNCH_WAIT_ATTEMPTS; i++) {
    await sleep(LAUNCH_POLL_MS);
    const s = await deps.fetchSession();
    if (s && serviceIsConnected(s)) {
      deps.onConnected(s);
      return;
    }
  }
  throw new Error("Miting is still starting. Try again in a moment.");
}

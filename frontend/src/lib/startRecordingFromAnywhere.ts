/**
 * Ask for a recording from any screen, and have it survive the trip.
 *
 * `start-recording-from-sidebar` is only listened for by `useRecordingStart`,
 * which the record screen mounts. Firing it after a fixed delay and hoping the
 * listener existed by then lost the request whenever the screen was slow to
 * mount — or landed in the gap while the listener re-registered — and the
 * caller had already told the user recording had begun.
 *
 * The request is written down first, so a screen that mounts later still finds
 * it. The event is only a nudge for the screen that is already up.
 */

const RECORD_ROUTE = '/';
const PENDING_KEY = 'pending_start_request';

/** Read/write helpers: storage can throw in a locked-down webview. */
const write = (value: string) => {
  try {
    sessionStorage.setItem(PENDING_KEY, value);
  } catch {
    /* the event below is still worth firing */
  }
};

const clear = () => {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing to clean up */
  }
};

const read = (): string | null => {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
};

/** How long a request stays valid — long enough to cover a slow mount. */
const REQUEST_TTL_MS = 30_000;

const dispatch = () => {
  window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'));
};

/**
 * Record a start request and try to serve it now.
 *
 * @param navigate router push, so Next handles the transition
 * @param currentPath the route the app is on right now
 * @param now injectable clock, for tests
 */
export function startRecordingFromAnywhere(
  navigate: (path: string) => void,
  currentPath: string,
  now: number = Date.now(),
): void {
  write(String(now));
  if (currentPath === RECORD_ROUTE) {
    dispatch();
    return;
  }
  navigate(RECORD_ROUTE);
  // The screen that mounts will pick the request up itself; this only helps
  // when the listener is already there.
  window.setTimeout(dispatch, 250);
}

/**
 * Consume a pending request, if one is still fresh. Returns true when the
 * caller should start recording.
 */
export function takePendingStartRequest(now: number = Date.now()): boolean {
  const raw = read();
  if (!raw) return false;
  clear();
  const requestedAt = Number(raw);
  if (!Number.isFinite(requestedAt)) return false;
  // A stale request must not start a recording minutes later.
  return now - requestedAt < REQUEST_TTL_MS;
}

/** Drop a request without acting on it (the start failed, or was refused). */
export function clearPendingStartRequest(): void {
  clear();
}

export { RECORD_ROUTE, REQUEST_TTL_MS };

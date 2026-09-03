/**
 * Which tab holds which session — one entry PER TAB.
 *
 * The predecessor (`activeCaptureStorage`) was a single slot: whichever tab
 * started last owned it, and every relay "resolved" ids against it. During a
 * handover or a second open Meet tab that slot was simply wrong, and captions
 * were stamped with another meeting's id. Ingest relays now use the id the
 * content script sends, verbatim — this map exists ONLY so the background can
 * pause the right session when its tab closes without a goodbye.
 *
 * Lives in chrome.storage.local (session-scoped data, but storage.session is
 * not exposed to MV3 workers on every channel) and is pruned on tab close.
 */

export interface TabCapture {
  sessionId: string;
  meetingCode: string;
}

const KEY = "mcs_tab_captures_v1";

type CaptureMap = Record<string, TabCapture>;

function isTabCapture(v: unknown): v is TabCapture {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as TabCapture).sessionId === "string" &&
    typeof (v as TabCapture).meetingCode === "string"
  );
}

async function readMap(): Promise<CaptureMap> {
  const raw = (await chrome.storage.local.get(KEY))[KEY];
  if (typeof raw !== "object" || raw === null) return {};
  const map: CaptureMap = {};
  for (const [tabId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (isTabCapture(entry)) map[tabId] = entry;
  }
  return map;
}

async function writeMap(map: CaptureMap): Promise<void> {
  await chrome.storage.local.set({ [KEY]: map });
}

export async function rememberTabCapture(tabId: number, capture: TabCapture): Promise<void> {
  const map = await readMap();
  map[String(tabId)] = capture;
  await writeMap(map);
}

export async function takeTabCapture(tabId: number): Promise<TabCapture | null> {
  const map = await readMap();
  const key = String(tabId);
  const entry = map[key] ?? null;
  if (entry) {
    delete map[key];
    await writeMap(map);
  }
  return entry;
}

/** Forget a session wherever it is held (its end/pause arrived normally). */
export async function forgetSession(sessionId: string): Promise<void> {
  const map = await readMap();
  let changed = false;
  for (const [tabId, entry] of Object.entries(map)) {
    if (entry.sessionId === sessionId) {
      delete map[tabId];
      changed = true;
    }
  }
  if (changed) await writeMap(map);
}

/** All captures currently held, newest knowledge of who records what. */
export async function listTabCaptures(): Promise<Array<{ tabId: number } & TabCapture>> {
  const map = await readMap();
  return Object.entries(map).map(([tabId, entry]) => ({ tabId: Number(tabId), ...entry }));
}

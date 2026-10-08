/**
 * Toolbar badge for the recording state.
 *
 * Per-tab badges throw "No tab with id" once that tab closes — and this is
 * called from listeners that outlive tabs — so a failed per-tab write falls
 * back to the global badge instead of crashing the service worker.
 */
export async function setBadgeRecording(active: boolean, tabId?: number): Promise<void> {
  const apply = async (opts: { tabId?: number }) => {
    await chrome.action.setBadgeText({ text: active ? "REC" : "", ...opts });
    if (active) {
      await chrome.action.setBadgeBackgroundColor({ color: "#dc362e", ...opts });
    }
    await chrome.action.setTitle({
      title: active ? "Miting: recording" : "Miting",
      ...opts,
    });
  };
  try {
    await apply(tabId !== undefined ? { tabId } : {});
  } catch {
    try {
      await apply({});
    } catch {
      /* browser shutting down — nothing to render on */
    }
  }
}

/**
 * Microphone permission handling, split from the page so it is unit-testable.
 * The stored flag is what the background worker reads when deciding whether to
 * mix the local mic into a capture, so it must track reality in both branches.
 */

export const MIC_GRANTED_KEY = "mcs_mic_permission_granted";

/** Page shown when the flag is false and a capture needs the mic. */
export const PERMISSION_PAGE = "permission.html";

async function remember(granted: boolean): Promise<void> {
  await chrome.storage.local.set({ [MIC_GRANTED_KEY]: granted });
}

/** Prompt for microphone access; records the outcome either way. */
export async function grantMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    await remember(true);
    return true;
  } catch {
    await remember(false);
    return false;
  }
}

/**
 * Current permission state, preferring the live Permissions API and falling
 * back to the stored flag where it is unavailable.
 */
export async function isMicrophoneGranted(): Promise<boolean> {
  try {
    const permission = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    const granted = permission.state === "granted";
    await remember(granted);
    return granted;
  } catch {
    const stored = await chrome.storage.local.get(MIC_GRANTED_KEY);
    return stored[MIC_GRANTED_KEY] === true;
  }
}

/** Open the permission page in a tab (there is no options page any more). */
export function openPermissionPage(): void {
  void chrome.tabs.create({ url: chrome.runtime.getURL(PERMISSION_PAGE) });
}

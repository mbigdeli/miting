/**
 * The one extension page left besides the popup: Chrome will only prompt for
 * microphone access from an extension page, never from a content script or the
 * service worker. Everything else that used to live in the options page moved
 * into the desktop app.
 */

import { grantMicrophone, MIC_GRANTED_KEY } from "./grantMicrophone.js";
import "./permission.css";

const button = document.getElementById("grant") as HTMLButtonElement | null;
const status = document.getElementById("status");

function report(text: string, ok: boolean): void {
  if (!status) return;
  status.textContent = text;
  status.dataset.state = ok ? "ok" : "error";
}

async function showCurrentState(): Promise<void> {
  const stored = await chrome.storage.local.get(MIC_GRANTED_KEY);
  if (stored[MIC_GRANTED_KEY] === true) {
    report("Microphone access is already granted. You can close this tab.", true);
  }
}

button?.addEventListener("click", () => {
  button.disabled = true;
  void grantMicrophone()
    .then((granted) => {
      report(
        granted
          ? "Microphone access granted. You can close this tab."
          : "Chrome refused the request. Allow the microphone in the site settings and try again.",
        granted,
      );
    })
    .finally(() => {
      button.disabled = false;
    });
});

void showCurrentState();

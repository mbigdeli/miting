/**
 * Pure view-model for Settings -> Chrome Extension (guided manual install).
 * Component-free so the vitest node suite can cover it.
 */

export interface ExtensionInstallStatus {
  bundledVersion: string | null;
  installedVersion: string | null;
  installPath: string;
}

export interface GuideStep {
  title: string;
  detail: string;
  /** Screenshot under frontend/public/extension-guide/ (drop-in later). */
  image: string;
  imageAlt: string;
}

export const CHROME_EXTENSIONS_URL = 'chrome://extensions';

/**
 * Why anyone would install this, stated before the how. The last line matters
 * most: the extension is an optimisation, never a requirement, and the tab
 * used to open with install steps that implied otherwise.
 */
export const EXTENSION_PITCH = {
  headline: 'Only for Google Meet calls.',
  points: [
    'Miting picks up the captions Google Meet already produces, instead of transcribing the call again on your machine.',
    'Optional — without it, Miting still records and transcribes Meet calls itself.',
  ],
} as const;

/** Silent screen-recording of the whole flow (menu -> Load unpacked -> done). */
export const GUIDE_VIDEO = '/extension-guide/install-walkthrough.mp4';

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    title: 'Turn on Developer mode',
    detail: `In Chrome, open ${CHROME_EXTENSIONS_URL} and flip the "Developer mode" switch in the top-right corner.`,
    image: '/extension-guide/step-1-developer-mode.png',
    imageAlt: 'Developer mode toggle on the chrome://extensions page',
  },
  {
    title: 'Click "Load unpacked"',
    detail: 'The button appears in the top-left once Developer mode is on. A folder picker opens.',
    image: '/extension-guide/step-2-load-unpacked.png',
    imageAlt: 'Load unpacked button on the chrome://extensions page',
  },
  {
    title: 'Pick the Miting extension folder',
    detail:
      '"Open folder" above reveals it. Miting Companion then appears in your extensions and pairs with the app automatically — no key or extra setup.',
    image: '/extension-guide/step-3-select-folder.png',
    imageAlt: 'Folder picker with the extension folder selected',
  },
];

/** Is there a bundled build the install dir doesn't have yet? */
export function needsInstall(s: ExtensionInstallStatus): boolean {
  return s.bundledVersion !== null && s.bundledVersion !== s.installedVersion;
}

export function installButtonLabel(s: ExtensionInstallStatus): string {
  if (s.installedVersion === null) return 'Prepare extension files';
  return needsInstall(s) ? 'Update extension files' : 'Refresh extension files';
}

export function statusLine(s: ExtensionInstallStatus): string {
  if (s.bundledVersion === null) {
    return 'This build does not include the extension files.';
  }
  if (s.installedVersion === null) {
    return `Version ${s.bundledVersion} is ready to prepare.`;
  }
  if (needsInstall(s)) {
    return `Prepared: v${s.installedVersion} — update v${s.bundledVersion} available.`;
  }
  return `Prepared: v${s.installedVersion} (up to date).`;
}

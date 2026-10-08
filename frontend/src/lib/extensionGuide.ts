/**
 * Pure view-model for Settings -> Chrome Extension (guided manual install).
 * Component-free so the vitest node suite can cover it.
 */

export interface ExtensionInstallStatus {
  bundledVersion: string | null;
  installedVersion: string | null;
  installPath: string;
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
    'Optional. Without it, Miting still records and transcribes Meet calls itself.',
  ],
} as const;

export interface GuideStepCopy {
  title: string;
  detail: string;
}

/** One line per step: the fake Chrome window next to it shows the rest. */
export function guideSteps(isMac: boolean): [GuideStepCopy, GuideStepCopy, GuideStepCopy] {
  return [
    {
      title: 'Turn on Developer mode',
      // Chrome ignores chrome:// links from other apps, so the address is pasted.
      detail: 'Paste chrome://extensions into the Chrome address bar. The switch is at the top right.',
    },
    { title: 'Click Load unpacked', detail: 'It appears at the top left once Developer mode is on.' },
    {
      title: 'Choose the Miting folder',
      // A Mac folder window has no address bar: ⌘⇧G opens Go to Folder.
      detail: isMac
        ? 'In the window that opens, press ⌘ ⇧ G, paste the path, press Return, then click Select.'
        : 'Paste the path into the address bar of the window that opens, then click Select Folder.',
    },
  ];
}

/** The path as the fake folder window shows it: `~` stands for the Mac home. */
export function displayPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+\//, '~/');
}

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
    return `Prepared: v${s.installedVersion}, update v${s.bundledVersion} available.`;
  }
  return `Prepared: v${s.installedVersion} (up to date).`;
}

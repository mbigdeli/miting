import { describe, expect, test } from 'vitest';
import {
  EXTENSION_PITCH,
  displayPath,
  guideSteps,
  installButtonLabel,
  needsInstall,
  statusLine,
  type ExtensionInstallStatus,
} from '../../src/lib/extensionGuide';

const status = (
  bundledVersion: string | null,
  installedVersion: string | null
): ExtensionInstallStatus => ({
  bundledVersion,
  installedVersion,
  installPath: 'C:\\Users\\me\\AppData\\Roaming\\li.bigde.miting\\extension',
});

describe('needsInstall', () => {
  test('true when never installed', () => {
    expect(needsInstall(status('0.1.0', null))).toBe(true);
  });
  test('true when bundled is newer than installed', () => {
    expect(needsInstall(status('0.2.0', '0.1.0'))).toBe(true);
  });
  test('false when versions match', () => {
    expect(needsInstall(status('0.1.0', '0.1.0'))).toBe(false);
  });
  test('false when nothing is bundled (dev build)', () => {
    expect(needsInstall(status(null, null))).toBe(false);
  });
});

describe('installButtonLabel', () => {
  test('first install / update / refresh wording', () => {
    expect(installButtonLabel(status('0.1.0', null))).toBe('Prepare extension files');
    expect(installButtonLabel(status('0.2.0', '0.1.0'))).toBe('Update extension files');
    expect(installButtonLabel(status('0.1.0', '0.1.0'))).toBe('Refresh extension files');
  });
});

describe('statusLine', () => {
  test('covers all four states distinctly', () => {
    const lines = [
      statusLine(status(null, null)),
      statusLine(status('0.1.0', null)),
      statusLine(status('0.2.0', '0.1.0')),
      statusLine(status('0.1.0', '0.1.0')),
    ];
    expect(new Set(lines).size).toBe(4);
    expect(lines[2]).toContain('0.2.0');
    expect(lines[2]).toContain('0.1.0');
  });
});

describe('EXTENSION_PITCH', () => {
  test('leads with the Google Meet scope', () => {
    expect(EXTENSION_PITCH.headline).toMatch(/google meet/i);
  });

  test('says outright that the extension is optional', () => {
    // The tab used to open with install steps, implying it was required.
    const text = EXTENSION_PITCH.points.join(' ');
    expect(text).toMatch(/optional/i);
    expect(text).toMatch(/still records and transcribes/i);
  });
});

describe('guideSteps', () => {
  test('three steps on both platforms', () => {
    expect(guideSteps(false)).toHaveLength(3);
    expect(guideSteps(true)).toHaveLength(3);
  });

  test('the Mac folder step uses Go to Folder, not an address bar', () => {
    expect(guideSteps(true)[2].detail).toMatch(/⌘ ⇧ G/);
    expect(guideSteps(false)[2].detail).toMatch(/address bar/);
  });

  test('copy has no dashes', () => {
    const text = [...guideSteps(true), ...guideSteps(false)].map((s) => s.title + s.detail).join(' ');
    expect(text).not.toMatch(/[–—]/);
  });
});

describe('displayPath', () => {
  test('shortens the Mac home to ~', () => {
    expect(displayPath('/Users/sam/Library/Application Support/li.bigde.miting/extension')).toBe(
      '~/Library/Application Support/li.bigde.miting/extension'
    );
  });

  test('leaves Windows paths alone', () => {
    expect(displayPath('C:\Users\sam\ext')).toBe('C:\Users\sam\ext');
  });
});

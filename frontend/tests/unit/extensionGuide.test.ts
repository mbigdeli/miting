import { describe, expect, test } from 'vitest';
import {
  EXTENSION_PITCH,
  GUIDE_STEPS,
  GUIDE_VIDEO,
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

describe('GUIDE_VIDEO', () => {
  test('walkthrough video lives under /extension-guide/', () => {
    expect(GUIDE_VIDEO).toMatch(/^\/extension-guide\/.+\.mp4$/);
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

describe('GUIDE_STEPS', () => {
  test('three steps, each with a screenshot slot under /extension-guide/', () => {
    expect(GUIDE_STEPS).toHaveLength(3);
    for (const step of GUIDE_STEPS) {
      expect(step.image).toMatch(/^\/extension-guide\/step-\d.+\.png$/);
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.imageAlt.length).toBeGreaterThan(0);
    }
  });
});

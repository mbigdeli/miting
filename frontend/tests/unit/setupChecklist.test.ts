import { describe, expect, it } from 'vitest';
import {
  missingSetupItems,
  setupFingerprint,
  shouldShowNotice,
  type SetupStatus,
} from '@/lib/setupChecklist';

const status = (overrides: Partial<SetupStatus> = {}): SetupStatus => ({
  transcriptionModelAvailable: true,
  summaryConfigured: true,
  summaryModelReady: true,
  ...overrides,
});

describe('missingSetupItems', () => {
  it('reports nothing when everything is installed', () => {
    expect(missingSetupItems(status())).toEqual([]);
  });

  it('lists a fresh install as missing both', () => {
    const items = missingSetupItems(
      status({
        transcriptionModelAvailable: false,
        summaryConfigured: false,
        summaryModelReady: false,
      })
    );
    expect(items.map((item) => item.id)).toEqual(['transcription', 'summary']);
  });

  it('counts a configured-but-unavailable summary model as missing', () => {
    const items = missingSetupItems(status({ summaryModelReady: false }));
    expect(items.map((item) => item.id)).toEqual(['summary']);
  });
});

describe('shouldShowNotice', () => {
  it('hides once the same set has been dismissed', () => {
    const items = missingSetupItems(status({ transcriptionModelAvailable: false }));
    expect(shouldShowNotice(items, null)).toBe(true);
    expect(shouldShowNotice(items, setupFingerprint(items))).toBe(false);
  });

  it('returns when a different piece of setup goes missing', () => {
    const dismissed = setupFingerprint(
      missingSetupItems(status({ transcriptionModelAvailable: false }))
    );
    const nowAlsoMissingSummary = missingSetupItems(
      status({ transcriptionModelAvailable: false, summaryModelReady: false })
    );
    expect(shouldShowNotice(nowAlsoMissingSummary, dismissed)).toBe(true);
  });

  it('stays hidden when nothing is missing, dismissed or not', () => {
    expect(shouldShowNotice([], null)).toBe(false);
  });
});

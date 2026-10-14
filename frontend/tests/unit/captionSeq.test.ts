import { describe, expect, test } from 'vitest';
import { CAPTION_SEQ_BASE, captionSeq } from '../../src/lib/translation/captionSeq';

describe('caption translation ids', () => {
  test('sit above every local sequence id and stay exact', () => {
    expect(captionSeq(7)).toBe(CAPTION_SEQ_BASE + 7);
    expect(Number.isSafeInteger(captionSeq(10_000_000))).toBe(true);
    expect(captionSeq(0)).toBeGreaterThan(1_000_000_000);
  });
});

import { describe, expect, test } from 'vitest';
import { levelColor, levelToPercent } from '@/lib/audioLevel';

describe('levelToPercent (dBFS mapping)', () => {
  test('silence and the -60 dB floor pin to 0', () => {
    expect(levelToPercent(0)).toBe(0);
    expect(levelToPercent(-1)).toBe(0);
    expect(levelToPercent(0.0009)).toBe(0); // below -60 dBFS
    expect(levelToPercent(Number.NaN)).toBe(0);
  });

  test('full scale is 100 and clamps above 1', () => {
    expect(levelToPercent(1)).toBe(100);
    expect(levelToPercent(2)).toBe(100);
  });

  test('speech-range amplitudes land mid-bar', () => {
    expect(levelToPercent(0.1)).toBe(67); // -20 dBFS
    expect(levelToPercent(0.03)).toBe(49); // ≈ -30.5 dBFS
    expect(levelToPercent(0.5)).toBe(90); // ≈ -6 dBFS
  });
});

describe('levelColor', () => {
  test('healthy / loud / clipping bands', () => {
    expect(levelColor(50)).toBe('green');
    expect(levelColor(69)).toBe('green');
    expect(levelColor(70)).toBe('yellow');
    expect(levelColor(89)).toBe('yellow');
    expect(levelColor(90)).toBe('red');
    expect(levelColor(100)).toBe('red');
  });
});

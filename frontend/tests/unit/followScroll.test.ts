import { describe, expect, test } from 'vitest';
import { followAfterScroll, isNearBottom, USER_INPUT_WINDOW_MS } from '../../src/lib/followScroll';

const atBottom = { scrollTop: 900, scrollHeight: 1500, clientHeight: 600 };
// Translations grew the content below the view: no longer "near bottom".
const grownBelow = { scrollTop: 900, scrollHeight: 1900, clientHeight: 600 };
const scrolledUp = { scrollTop: 100, scrollHeight: 1500, clientHeight: 600 };

describe('following the live transcript', () => {
  test('content growing on its own never stops following', () => {
    expect(isNearBottom(grownBelow)).toBe(false);
    expect(followAfterScroll(true, grownBelow, 10_000, 0)).toBe(true);
  });

  test('the user scrolling up stops it, scrolling back down resumes it', () => {
    const now = 10_000;
    expect(followAfterScroll(true, scrolledUp, now, now - 50)).toBe(false);
    expect(followAfterScroll(false, atBottom, now, now - 50)).toBe(true);
  });

  test('old input does not count as the user scrolling', () => {
    const now = 10_000;
    expect(followAfterScroll(false, atBottom, now, now - USER_INPUT_WINDOW_MS - 1)).toBe(false);
  });
});

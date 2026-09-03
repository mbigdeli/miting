import { describe, expect, it } from 'vitest';
import { groupBySpeaker, mergeCaption, startsNewSession, type LiveCaption } from '@/lib/liveCaptions';

/**
 * Meet sends an utterance again every time it grows. The ingest server keeps
 * rewriting one row, so the id is the thing that identifies "the sentence
 * currently being spoken" — not arrival order, and not the text.
 */
const cap = (id: number, speaker: string | null, text: string): LiveCaption => ({ id, speaker, text });

describe('mergeCaption', () => {
  it('grows the line in place as Meet extends it', () => {
    let list: LiveCaption[] = [];
    list = mergeCaption(list, cap(1, 'Sam', 'salam'));
    list = mergeCaption(list, cap(1, 'Sam', 'salam chetori'));
    list = mergeCaption(list, cap(1, 'Sam', 'salam chetori khubi'));

    expect(list).toEqual([cap(1, 'Sam', 'salam chetori khubi')]);
  });

  it('starts a new line for a new row', () => {
    let list = mergeCaption([], cap(1, 'Sam', 'salam'));
    list = mergeCaption(list, cap(2, 'Ali', 'man khubam'));

    expect(list.map((c) => c.text)).toEqual(['salam', 'man khubam']);
  });

  it('returns the same array when nothing changed, so the view can skip a render', () => {
    const list = mergeCaption([], cap(1, 'Sam', 'salam'));

    expect(mergeCaption(list, cap(1, 'Sam', 'salam'))).toBe(list);
    expect(mergeCaption(list, cap(1, 'Sam', '  salam  '))).toBe(list);
  });

  it('ignores an empty caption rather than opening a blank line', () => {
    const list = mergeCaption([], cap(1, 'Sam', 'salam'));

    expect(mergeCaption(list, cap(2, 'Ali', '   '))).toBe(list);
    expect(mergeCaption([], cap(1, null, ''))).toEqual([]);
  });

  it('lets a speaker be corrected without losing the line', () => {
    let list = mergeCaption([], cap(1, null, 'salam'));
    list = mergeCaption(list, cap(1, 'Sam', 'salam'));

    expect(list).toEqual([cap(1, 'Sam', 'salam')]);
  });
});

describe('groupBySpeaker', () => {
  it('joins consecutive lines from one speaker into a turn', () => {
    const turns = groupBySpeaker([
      cap(1, 'Sam', 'salam'),
      cap(2, 'Sam', 'chetori'),
      cap(3, 'Ali', 'man khubam'),
      cap(4, 'Sam', 'khoshhalam'),
    ]);

    expect(turns).toEqual([
      { speaker: 'Sam', text: 'salam chetori' },
      { speaker: 'Ali', text: 'man khubam' },
      { speaker: 'Sam', text: 'khoshhalam' },
    ]);
  });

  it('treats an unnamed speaker as its own run', () => {
    const turns = groupBySpeaker([cap(1, null, 'one'), cap(2, null, 'two')]);

    expect(turns).toEqual([{ speaker: null, text: 'one two' }]);
  });
});

describe('startsNewSession', () => {
  it('is true only on the edge where recording begins', () => {
    expect(startsNewSession(false, true)).toBe(true);
  });

  /**
   * The regression this guards: the Record screen unmounts on every navigation,
   * so a mount during a live call used to be indistinguishable from a new
   * meeting and wiped every caption already on screen.
   */
  it('stays false while a recording continues', () => {
    expect(startsNewSession(true, true)).toBe(false);
  });

  it('stays false when a recording stops, so the lines remain readable', () => {
    expect(startsNewSession(true, false)).toBe(false);
  });

  it('stays false when nothing is recording', () => {
    expect(startsNewSession(false, false)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { cardMoment, cardsByLine, lineAt, playingLine } from '@/lib/notes/anchor';
import { checkStates, tickChanged } from '@/lib/notes/checklist';
import { clock, detectMode, linkTimes, parseClock } from '@/lib/notes/detect';
import { splitHighlights } from '@/lib/notes/highlight';
import type { LineRef, NoteCard } from '@/lib/notes/types';

const lines: LineRef[] = [
  { key: 'a', at: 4 },
  { key: 'b', at: 21 },
  { key: 'c', at: 39 },
  { key: 'd', at: 66 },
];

const card = (id: string, atSec: number | null, quoteAt?: number): NoteCard => ({
  id,
  atSec,
  bodyHtml: id,
  quotes: quoteAt === undefined ? [] : [{ quote: 'q', at: quoteAt }],
  source: 'user',
  edited: false,
});

describe('detectMode', () => {
  it('sends questions to Ask AI and everything else to notes', () => {
    expect(detectMode('Safari bug, hotfix this week')).toBe('note');
    expect(detectMode('hotfix this week?')).toBe('ask');
    expect(detectMode('What did I miss')).toBe('ask');
    expect(detectMode('Summarize the last 5 minutes')).toBe('ask');
    expect(detectMode('چرا ۹۶ دلار')).toBe('ask');
    expect(detectMode('از فایننس بپرسم؟')).toBe('ask');
    expect(detectMode('whatever happens, ship it')).toBe('note');
    expect(detectMode('   ')).toBe('note');
  });
});

describe('clock and citations', () => {
  it('formats and parses times like the Rust side', () => {
    expect(clock(66)).toBe('01:06');
    expect(clock(3725)).toBe('1:02:05');
    expect(parseClock('01:06')).toBe(66);
    expect(parseClock('1:02:05')).toBe(3725);
    expect(parseClock('01:75')).toBeNull();
  });

  it('turns [mm:ss] into links but leaves real links alone', () => {
    expect(linkTimes('Sam ships [01:06].')).toBe('Sam ships [01:06](#t=66).');
    expect(linkTimes('See [01:06](http://x)')).toBe('See [01:06](http://x)');
  });
});

describe('anchoring cards to lines', () => {
  it('finds the line spoken at a moment', () => {
    expect(lineAt(lines, 45)).toBe('c');
    expect(lineAt(lines, 1)).toBe('a');
    expect(lineAt(lines, 999)).toBe('d');
  });

  it('places a card under its first quote, else its moment, timeless ones last', () => {
    const byLine = cardsByLine(lines, [card('late', null), card('noted', 45), card('quoted', 90, 22)]);
    expect(byLine.get('b')?.map((c) => c.id)).toEqual(['quoted']);
    expect(byLine.get('c')?.map((c) => c.id)).toEqual(['noted']);
    expect(byLine.get('d')?.map((c) => c.id)).toEqual(['late']);
    expect(cardMoment(card('x', 90, 22))).toBe(22);
  });

  it('knows the line being played, and none before playback', () => {
    expect(playingLine(lines, 0)).toBeNull();
    expect(playingLine(lines, 40)).toBe('c');
  });
});

describe('splitHighlights', () => {
  it('tints quoted words and lets a pending selection win', () => {
    const parts = splitHighlights('Finance wants 96 dollars instead of 120', [
      { quote: '96 dollars', kind: 'saved' },
      { quote: 'dollars instead', kind: 'pending' },
    ]);
    expect(parts).toEqual([
      { text: 'Finance wants 96 ' },
      { text: 'dollars instead', kind: 'pending' },
      { text: ' of 120' },
    ]);
  });

  it('returns the text unchanged when nothing matches', () => {
    expect(splitHighlights('hello', [{ quote: 'bye', kind: 'saved' }])).toEqual([{ text: 'hello' }]);
  });
});

describe('checklist ticks', () => {
  const doc = (checked: boolean, extra = false) => [
    { id: 'h', type: 'heading' },
    { id: 't1', type: 'checkListItem', props: { checked }, children: [] },
    ...(extra ? [{ id: 't2', type: 'checkListItem', props: { checked: false } }] : []),
  ];

  it('saves on a tick, not on adding an item', () => {
    expect(tickChanged(checkStates(doc(false)), checkStates(doc(true)))).toBe(true);
    expect(tickChanged(checkStates(doc(false)), checkStates(doc(false, true)))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { displayTextFor, type StreamingSegment } from '@/lib/transcriptStreaming';

const snap = (over: Partial<StreamingSegment> = {}): StreamingSegment => ({
  id: 'gmeet-42',
  fullText: 'You: salam',
  visibleText: 'You: ',
  ...over,
});

describe('displayTextFor — a live caption is never frozen by its animation', () => {
  it('animates while the snapshot still matches the text', () => {
    const seg = { id: 'gmeet-42', text: 'You: salam' };
    expect(displayTextFor(seg, snap())).toBe('You: ');
  });

  it('a GROWN caption shows its live text, not the stale snapshot', () => {
    // The bug: Meet grows the same row's text for the whole utterance, but the
    // snapshot pinned the view to the first few words until the next speaker.
    const seg = { id: 'gmeet-42', text: 'You: salam chetori khubi?' };
    expect(displayTextFor(seg, snap())).toBe('You: salam chetori khubi?');
  });

  it('other rows are untouched by the animation', () => {
    const seg = { id: 'gmeet-7', text: 'Ali: dorood' };
    expect(displayTextFor(seg, snap())).toBe('Ali: dorood');
  });

  it('no animation, no change', () => {
    const seg = { id: 'gmeet-42', text: 'You: salam' };
    expect(displayTextFor(seg, null)).toBe('You: salam');
  });
});

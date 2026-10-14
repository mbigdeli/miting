import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyLive, loadLive, markInflight, resolveLiveAsk, saveLive } from '@/lib/notes/liveStore';
import type { AskItem } from '@/lib/notes/types';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const pending = (id: string): AskItem => ({
  id, askedAtSec: 10, question: 'What did I miss?', quotes: [], answerMd: null, citations: [],
  error: null, provider: null, model: null, savedNoteId: null, pending: true,
});

afterEach(() => vi.unstubAllGlobals());

describe('live Ask AI across navigation', () => {
  it('keeps a question that is still being answered, and stores the answer that lands later', () => {
    const storage = memoryStorage();
    const events: string[] = [];
    vi.stubGlobal('window', {
      localStorage: storage,
      dispatchEvent: (e: Event) => void events.push(e.type),
    });
    vi.stubGlobal('CustomEvent', class extends Event { detail: unknown; constructor(t: string, i?: { detail?: unknown }) { super(t); this.detail = i?.detail; } });

    const v = emptyLive('rec-1');
    v.asks.push(pending('p1'), pending('stale'));
    markInflight('p1');
    saveLive(v);

    // The screen comes back while the answer is still on its way.
    expect(loadLive('rec-1').asks.map((a) => a.id)).toEqual(['p1']);

    // The answer arrives with no screen mounted.
    resolveLiveAsk('rec-1', 'p1', (a) => ({ ...a, id: 'a1', pending: false, answerMd: 'Sam ships [01:06].' }));
    const after = loadLive('rec-1').asks;
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ id: 'a1', answerMd: 'Sam ships [01:06].' });
    expect(events).toContain('miting:live-ask');
  });
});

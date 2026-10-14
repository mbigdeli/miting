import { describe, expect, it } from 'vitest';
import { clearLive, emptyLive, loadLive, peekLive, saveLive } from '@/lib/notes/liveStore';
import { answerToNoteHtml, noteText, sanitizeNoteHtml } from '@/lib/notes/sanitize';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('live notes store', () => {
  it('keeps notes for the same recording and drops another recording', () => {
    const s = memoryStorage();
    const v = emptyLive('rec-1');
    v.cards.push({ id: 'n', atSec: 5, bodyHtml: 'x', quotes: [], source: 'user', edited: false });
    saveLive(v, s);
    expect(loadLive('rec-1', s).cards).toHaveLength(1);
    expect(loadLive('rec-2', s).cards).toHaveLength(0);
  });

  it('forgets questions that never got an answer (a reload mid-question)', () => {
    const s = memoryStorage();
    const v = emptyLive('rec-1');
    v.asks.push({
      id: 'p', askedAtSec: 1, question: 'q', quotes: [], answerMd: null, citations: [], error: null,
      provider: null, model: null, savedNoteId: null, pending: true,
    });
    saveLive(v, s);
    expect(loadLive('rec-1', s).asks).toHaveLength(0);
  });

  it('is only cleared on request (after a successful handover)', () => {
    const s = memoryStorage();
    saveLive(emptyLive('rec-1'), s);
    expect(peekLive(s)?.session).toBe('rec-1');
    expect(peekLive(s)).not.toBeNull();
    clearLive(s);
    expect(peekLive(s)).toBeNull();
  });
});

describe('note html', () => {
  it('keeps plain formatting and strips everything else', () => {
    expect(sanitizeNoteHtml('<b onclick="x()">Safari</b> <img src=x onerror=alert(1)><script>evil()</script>bug'))
      .toBe('<b>Safari</b> bug');
    expect(sanitizeNoteHtml('<a href="javascript:x">link</a><ul><li>one</li></ul>')).toBe('link<ul><li>one</li></ul>');
  });

  it('reads note text for emptiness checks', () => {
    expect(noteText('<div><br></div>&nbsp;')).toBe('');
    expect(noteText('<b>hi</b> there')).toBe('hi there');
  });

  it('turns a saved answer into a note with the question in bold', () => {
    expect(answerToNoteHtml('Who ships?', '**Sam** ships [01:06].\n- QA Wednesday\n- <x>'))
      .toBe('<b>Who ships?</b><div><b>Sam</b> ships [01:06].</div><ul><li>QA Wednesday</li><li>&lt;x&gt;</li></ul>');
  });
});

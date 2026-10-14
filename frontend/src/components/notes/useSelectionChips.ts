'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Quote } from '@/lib/notes/types';

/** Longest selection kept as context; a whole page of transcript is not a quote. */
const MAX_QUOTE = 600;

/**
 * Selecting text in a transcript line adds it to the box as context. Lines
 * opt in with `data-line-at` (their start second) inside a container marked
 * `data-notes-transcript`; note cards are excluded.
 */
export function useSelectionChips(focusComposer: () => void) {
  const [chips, setChips] = useState<Quote[]>([]);

  const add = useCallback((q: Quote) => {
    setChips((cs) => (cs.some((c) => c.quote === q.quote && c.at === q.at) ? cs : [...cs, q]));
  }, []);
  const remove = useCallback((i: number) => setChips((cs) => cs.filter((_, j) => j !== i)), []);
  const clear = useCallback(() => setChips([]), []);

  useEffect(() => {
    const onUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().replace(/\s+/g, ' ').trim();
      if (!sel || !text || !sel.anchorNode) return;
      const node = sel.anchorNode;
      const el = node instanceof Element ? node : node.parentElement;
      if (!el || el.closest('[data-note-card]') || !el.closest('[data-notes-transcript]')) return;
      const line = el.closest('[data-line-at]');
      const at = Number(line?.getAttribute('data-line-at'));
      if (!line || !Number.isFinite(at)) return;
      add({ quote: text.slice(0, MAX_QUOTE), at });
      sel.removeAllRanges();
      focusComposer();
    };
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, [add, focusComposer]);

  return useMemo(() => ({ chips, add, remove, clear }), [chips, add, remove, clear]);
}

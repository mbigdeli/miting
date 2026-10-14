'use client';

import { useCallback, useMemo, useRef } from 'react';
import { type BlockLike, checkStates, tickChanged } from '@/lib/notes/checklist';

/**
 * Action items are a checklist; ticking one saves the summary at once,
 * without the Save button (doc 20). `prime` with the loaded content, then
 * call `onChange` on every editor change.
 */
export function useChecklistAutosave<B>(save: (blocks: B[]) => void) {
  const last = useRef<Map<string, boolean> | null>(null);
  const prime = useCallback((blocks: unknown[]) => {
    last.current = checkStates(blocks as BlockLike[]);
  }, []);
  const onChange = useCallback(
    (blocks: B[]) => {
      const now = checkStates(blocks as unknown as BlockLike[]);
      const before = last.current;
      last.current = now;
      if (before && tickChanged(before, now)) save(blocks);
    },
    [save]
  );
  return useMemo(() => ({ prime, onChange }), [prime, onChange]);
}

import { useMemo, useState } from 'react';
import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import type { LineRef } from '@/lib/notes/types';
import type { TranscriptSegmentData } from '@/types';

/** Search filter and line index for the Transcript tab (speaker or raw view). */
export function useTranscriptView(diarized: DiarizedSegment[], segments: TranscriptSegmentData[]) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const hasDiarized = diarized.length > 0;

  const filteredDiarized = useMemo(
    () =>
      q
        ? diarized.filter(
            (s) => s.text.toLowerCase().includes(q) || (s.speaker_name ?? '').toLowerCase().includes(q)
          )
        : diarized,
    [diarized, q]
  );
  const filteredRaw = useMemo(
    () => (q ? segments.filter((s) => s.text.toLowerCase().includes(q)) : segments),
    [segments, q]
  );
  const lines = useMemo<LineRef[]>(
    () =>
      hasDiarized
        ? diarized.map((d) => ({ key: `diarized-${d.seq}`, at: d.start_sec ?? null }))
        : segments.map((s) => ({ key: s.id, at: s.timestamp })),
    [hasDiarized, diarized, segments]
  );

  // Raw + unfiltered keeps the virtualized, paginated view; everything else is a plain scroll list.
  const useVirtualized = !hasDiarized && !q;
  return { query, setQuery, q, hasDiarized, filteredDiarized, filteredRaw, lines, useVirtualized };
}

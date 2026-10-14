'use client';

import { useEffect, useRef } from 'react';
import { playingLine } from '@/lib/notes/anchor';
import type { LineRef } from '@/lib/notes/types';
import { useMeetingAudio } from './MeetingAudio';

/**
 * The line under the playhead, and while playing (or right after a seek) the
 * page follows it. `scrollTo` handles lines that are not on screen yet, such
 * as rows of a virtualized list.
 */
export function usePlayingLine(lines: LineRef[], scrollTo?: (key: string) => void): string | null {
  const audio = useMeetingAudio();
  const time = audio?.time ?? 0;
  const key = audio && (audio.playing || time > 0) ? playingLine(lines, time) : null;
  const followed = useRef<string | null>(null);

  useEffect(() => {
    if (!key || key === followed.current) return;
    followed.current = key;
    if (scrollTo) scrollTo(key);
    else document.getElementById(`segment-${key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [key, scrollTo]);

  return key;
}

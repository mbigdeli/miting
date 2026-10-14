'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecordingSrc } from './useRecordingSrc';

/**
 * Play short stretches of the meeting recording ("Listen" on a speaker), so
 * the user can hear who "Speaker 2" is before naming them. One clip at a time.
 */
export function useSamplePlayer(folderPath?: string | null) {
  const { src } = useRecordingSrc(folderPath);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(null);
  }, []);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audio.preload = 'metadata';
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
      setPlaying(null);
    };
  }, [src]);

  const play = useCallback(
    (key: string, start: number, end: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing === key) return stop();
      audio.pause();
      audio.currentTime = start;
      audio.ontimeupdate = () => {
        if (audio.currentTime >= end) stop();
      };
      audio.onended = stop;
      setPlaying(key);
      audio.play().catch(() => setPlaying(null));
    },
    [playing, stop]
  );

  return { ready: !!src, playing, play };
}

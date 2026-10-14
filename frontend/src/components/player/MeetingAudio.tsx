'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRecordingSrc } from './useRecordingSrc';

export interface MeetingAudioApi {
  available: boolean;
  missing: boolean;
  playing: boolean;
  time: number;
  duration: number;
  /** Seconds the player has reached, or null before it was ever played. */
  position: () => number | null;
  toggle: () => void;
  seek: (sec: number, play?: boolean) => void;
}

const Ctx = createContext<MeetingAudioApi | null>(null);

/** One audio element per miting, shared by the Transcript and Details tabs. */
export function MeetingAudioProvider({ folderPath, children }: { folderPath?: string | null; children: ReactNode }) {
  const { src, error } = useRecordingSrc(folderPath);
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    started.current = false;
    setTime(0);
    setPlaying(false);
  }, [src]);

  const toggle = useCallback(() => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  }, []);
  const seek = useCallback((sec: number, play = true) => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = Math.max(0, sec);
    started.current = true;
    setTime(a.currentTime);
    if (play && a.paused) void a.play().catch(() => setPlaying(false));
  }, []);
  const position = useCallback(() => (started.current ? (ref.current?.currentTime ?? null) : null), []);

  const value = useMemo<MeetingAudioApi>(
    () => ({ available: !!src, missing: !!error, playing, time, duration, position, toggle, seek }),
    [src, error, playing, time, duration, position, toggle, seek]
  );
  return (
    <Ctx.Provider value={value}>
      {src && (
        <audio
          ref={ref}
          src={src}
          preload="metadata"
          className="hidden"
          onPlay={() => {
            started.current = true;
            setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        />
      )}
      {children}
    </Ctx.Provider>
  );
}

export function useMeetingAudio(): MeetingAudioApi | null {
  return useContext(Ctx);
}

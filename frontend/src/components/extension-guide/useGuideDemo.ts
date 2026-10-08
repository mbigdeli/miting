'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { demoFrames, type CursorMove, type DemoFrame } from '@/lib/extensionDemo';

/**
 * Plays the walkthrough frames in a loop until stopped. Any click on a step
 * or button stops it (the caller decides), so the user is never fighting the
 * animation for control.
 */
export function useGuideDemo(isMac: boolean, pathLength: number, autoPlay: boolean) {
  const frames = useMemo(() => demoFrames(isMac, pathLength), [isMac, pathLength]);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);

  // Onboarding starts it by itself, a moment after the screen appears.
  useEffect(() => {
    if (!autoPlay) return;
    const t = setTimeout(() => setPlaying(true), 900);
    return () => clearTimeout(t);
  }, [autoPlay]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % frames.length), frames[index].ms);
    return () => clearTimeout(t);
  }, [playing, index, frames]);

  const play = useCallback(() => {
    setIndex(0);
    setPlaying(true);
  }, []);
  const stop = useCallback(() => setPlaying(false), []);

  const frame: DemoFrame | null = playing ? frames[index] : null;
  // Frames without a move (typing, key presses) keep the pointer where the
  // last move left it, without replaying its click.
  const cursor = useMemo<CursorMove | null>(() => {
    if (!playing) return null;
    for (let i = index; i >= 0; i--) {
      const move = frames[i].cursor;
      if (move) return i === index ? move : { ...move, click: false, instant: true };
    }
    return null;
  }, [playing, index, frames]);
  return { playing, frame, cursor, tick: index, play, stop };
}

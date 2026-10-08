import React, { useLayoutEffect, useState } from 'react';
import type { CursorMove } from '@/lib/extensionDemo';
import { cn } from '@/lib/utils';

/**
 * The pointer that walks through the steps. It finds its target by the
 * `data-demo` attribute inside `root`, so the drawing and the timeline only
 * share names, not coordinates.
 */
export function DemoCursor({ root, move, tick }: {
  root: React.RefObject<HTMLElement | null>;
  move: CursorMove | null;
  /** Changes on every frame, so the click ring replays. */
  tick: number;
}) {
  const [at, setAt] = useState<{ x: number; y: number; instant: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!move || !root.current) return;
    const target = root.current.querySelector(`[data-demo="${move.target}"]`);
    if (!target) return;
    const box = root.current.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    setAt({
      x: r.left - box.left + r.width / 2 + (move.dx ?? 0),
      y: r.top - box.top + r.height / 2 + (move.dy ?? 0),
      instant: Boolean(move.instant),
    });
  }, [move, root, tick]);

  if (!move || !at) return null;
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-0 top-0 z-[90] drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]',
        !at.instant && 'transition-transform duration-700 ease-[cubic-bezier(.4,0,.2,1)]',
      )}
      style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
    >
      <svg width="22" height="26" viewBox="0 0 22 26">
        <path
          d="M2 1.5 20 14.2l-7.6 1 4.4 8.3-3.4 1.6-4.3-8.4L2 22.4Z"
          fill="#111"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      {move.click && (
        <span
          key={tick}
          className="absolute -left-3.5 -top-3.5 h-8 w-8 animate-[demo-ripple_0.5s_ease-out_forwards] rounded-full border-[3px] border-brand opacity-0"
        />
      )}
    </div>
  );
}

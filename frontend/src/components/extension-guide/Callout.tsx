import React from 'react';
import { cn } from '@/lib/utils';

/** Teal ring around the control the user has to press. */
export const RING = 'shadow-[0_0_0_3px_#00857A,0_0_0_7px_rgba(0,133,122,0.25)]';

/** Small teal label next to a ringed control. */
export function Tag({ children, side = 'left', up = false }: {
  children: React.ReactNode;
  side?: 'left' | 'right';
  up?: boolean;
}) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute z-[2] whitespace-nowrap rounded-md bg-brand px-[9px] py-1 font-inter text-[11.5px] font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]',
        side === 'left' ? 'left-0' : 'right-0',
        up ? 'bottom-full mb-2' : 'top-full mt-2',
      )}
    >
      {children}
    </span>
  );
}

/** A keyboard key, inline in copy or large over the fake window. */
export function Key({ children, big = false }: { children: React.ReactNode; big?: boolean }) {
  return (
    <kbd
      className={cn(
        'inline-grid place-items-center border border-b-2 bg-white font-inter font-semibold leading-none',
        big
          ? 'h-[46px] min-w-[46px] rounded-[9px] border-white border-b-[3px] px-2.5 text-[21px] text-zinc-900'
          : 'mx-px h-[18px] min-w-[18px] rounded px-1 align-[1px] text-[11px] text-zinc-700 border-zinc-300',
      )}
    >
      {children}
    </kbd>
  );
}

/** Keys pressed during the Mac walkthrough, shown over the folder window. */
export function KeyOverlay({ keys, label }: { keys: string[]; label?: string }) {
  return (
    <div className="absolute left-1/2 top-1/2 z-[6] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-[14px] bg-zinc-900/80 px-[18px] py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
      {keys.map((k) => (
        <Key key={k} big>
          {k}
        </Key>
      ))}
      {label && <span className="ml-1.5 text-[13px] font-semibold text-white">{label}</span>}
    </div>
  );
}

/** Chrome's logo, drawn rather than loaded so it works offline. */
export function ChromeMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.474 6.5A11 11 0 0 1 21.526 6.5L16.33 9.5A5 5 0 0 0 7.67 9.5Z" fill="#EA4335" />
      <path d="M21.526 6.5A11 11 0 0 1 12 23L12 17A5 5 0 0 0 16.33 9.5Z" fill="#FBBC04" />
      <path d="M12 23A11 11 0 0 1 2.474 6.5L7.67 9.5A5 5 0 0 0 12 17Z" fill="#34A853" />
      <circle cx="12" cy="12" r="5" fill="#FFFFFF" />
      <circle cx="12" cy="12" r="4" fill="#4285F4" />
    </svg>
  );
}

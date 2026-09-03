'use client';

import React from 'react';
import { EXTENSION_PITCH } from '@/lib/extensionGuide';

/** Why the extension exists, above the how — it is optional, not a dependency. */
export function PitchCard() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
      <p className="text-[13.5px] font-medium text-zinc-900">{EXTENSION_PITCH.headline}</p>
      <ul className="mt-2 grid gap-1.5">
        {EXTENSION_PITCH.points.map((point) => (
          <li key={point} className="flex items-baseline gap-2 text-[13px] text-zinc-600">
            <span className="size-[5px] shrink-0 -translate-y-0.5 rounded-full bg-brand" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

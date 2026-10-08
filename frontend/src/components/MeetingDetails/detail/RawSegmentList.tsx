'use client';

import type { TranscriptSegmentData } from '@/types';
import { rtlTextProps } from '@/lib/rtl';
import { TranslationLine } from '@/components/translation/TranslationLine';

function fmt(sec: number): string {
  const t = Math.floor(sec);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Plain (non-virtualized) transcript lines, used for search results. */
export function RawSegmentList({ segments }: { segments: TranscriptSegmentData[] }) {
  if (segments.length === 0) {
    return <p className="py-10 text-center text-[13px] text-zinc-400">No matching transcript lines.</p>;
  }
  return (
    <div className="ph-no-capture grid gap-4">
      {segments.map((s) => {
        const rtl = rtlTextProps(s.text);
        return (
          <div key={s.id}>
            <span className="text-[11.5px] tabular-nums text-zinc-400">{fmt(s.timestamp)}</span>
            <p dir={rtl.dir} className={`mt-1 text-sm leading-7 text-zinc-700 ${rtl.className}`}>
              {s.text}
            </p>
            <TranslationLine translation={s.translation} />
          </div>
        );
      })}
    </div>
  );
}

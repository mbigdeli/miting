'use client';

import type { TranscriptSegmentData } from '@/types';
import { rtlTextProps } from '@/lib/rtl';
import { TranslationLine } from '@/components/translation/TranslationLine';
import { LineCards, LineText, useTranscriptDecor } from '@/components/notes/TranscriptDecor';

function fmt(sec: number): string {
  const t = Math.floor(sec);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Plain (non-virtualized) transcript lines, used for search results. */
export function RawSegmentList({ segments }: { segments: TranscriptSegmentData[] }) {
  const decor = useTranscriptDecor();
  if (segments.length === 0) {
    return <p className="py-10 text-center text-[13px] text-zinc-400">No matching transcript lines.</p>;
  }
  return (
    <div className="ph-no-capture grid gap-4">
      {segments.map((s) => {
        const rtl = rtlTextProps(s.text);
        const playing = decor?.activeKey === s.id;
        return (
          <div
            key={s.id}
            id={`segment-${s.id}`}
            data-line-at={s.timestamp}
            className={playing ? '-mx-2 rounded-md bg-[#F6FAF9] px-2 shadow-[inset_2px_0_0_#9CC9C3]' : ''}
          >
            <button
              type="button"
              disabled={!decor?.seek}
              onClick={() => decor?.seek?.(s.timestamp)}
              className="text-[11.5px] tabular-nums text-zinc-400 enabled:hover:text-zinc-700"
            >
              {fmt(s.timestamp)}
            </button>
            <p dir={rtl.dir} className={`mt-1 text-sm leading-7 text-zinc-700 ${rtl.className}`}>
              <LineText text={s.text} />
            </p>
            <TranslationLine translation={s.translation} />
            <LineCards lineKey={s.id} />
          </div>
        );
      })}
    </div>
  );
}

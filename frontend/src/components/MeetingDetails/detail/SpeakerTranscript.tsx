'use client';

import { memo } from 'react';
import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import { rtlTextProps } from '@/lib/rtl';
import type { SegmentTranslation } from '@/lib/translation/types';
import { TranslationLine } from '@/components/translation/TranslationLine';
import { LineCards, LineText, useTranscriptDecor } from '@/components/notes/TranscriptDecor';
import SpeakerChipMenu from './SpeakerChipMenu';
import { groupBySpeaker, type SpeakerGroup } from './speakerGroups';
import { chipFor, formatTime } from './speakerStyle';

type TranslationFor = (seq: number) => SegmentTranslation | undefined;

/** Optional hooks shared by every block: translations and moving lines. */
interface BlockOptions {
  translationFor?: TranslationFor;
  /** Everyone who can be picked in "Said by…". */
  speakerNames?: string[];
  onReassign?: (seqs: number[], to: string) => void;
}

const PLAYING = '-mx-2 rounded-md bg-[#F6FAF9] px-2 shadow-[inset_2px_0_0_#9CC9C3]';

const GroupBlock = memo(function GroupBlock({
  group,
  translationFor,
  speakerNames = [],
  onReassign,
}: { group: SpeakerGroup } & BlockOptions) {
  const decor = useTranscriptDecor();
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <SpeakerChipMenu
          name={group.name}
          chipClass={chipFor(group.name)}
          others={speakerNames.filter((n) => n !== group.name)}
          onMove={onReassign && ((to) => onReassign(group.lines.map((l) => l.seq), to))}
        />
        {group.startSec !== null && (
          <button
            type="button"
            disabled={!decor?.seek}
            onClick={() => group.startSec !== null && decor?.seek?.(group.startSec)}
            className="text-[11.5px] tabular-nums text-zinc-400 enabled:hover:text-zinc-700"
          >
            {formatTime(group.startSec)}
          </button>
        )}
      </div>
      {group.lines.map(({ seq, text, startSec }) => {
        const rtl = rtlTextProps(text);
        const key = `diarized-${seq}`;
        return (
          <div
            key={seq}
            id={`segment-${key}`}
            data-line-at={startSec ?? group.startSec ?? undefined}
            className={decor?.activeKey === key ? PLAYING : ''}
          >
            <p dir={rtl.dir} className={`mt-1.5 text-sm leading-7 text-zinc-700 ${rtl.className}`}>
              <LineText text={text} />
            </p>
            <TranslationLine translation={translationFor?.(seq)} />
            <LineCards lineKey={key} />
          </div>
        );
      })}
    </div>
  );
});

/** Who-said-what reading pane for the diarized transcript (mockups 2i / 2r). */
export default function SpeakerTranscript({
  segments,
  ...options
}: { segments: DiarizedSegment[] } & BlockOptions) {
  if (segments.length === 0) {
    return (
      <p className="py-10 text-center text-[13px] text-zinc-400">
        No matching transcript lines.
      </p>
    );
  }
  return (
    // ph-no-capture: meeting content stays out of session replays
    <div className="ph-no-capture grid gap-5">
      {groupBySpeaker(segments).map((group, i) => (
        <GroupBlock key={i} group={group} {...options} />
      ))}
    </div>
  );
}

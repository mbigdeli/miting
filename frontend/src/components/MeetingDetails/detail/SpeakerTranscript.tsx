'use client';

import { memo } from 'react';
import type { DiarizedSegment } from '@/components/DiarizedTranscriptView';
import { rtlTextProps } from '@/lib/rtl';
import type { SegmentTranslation } from '@/lib/translation/types';
import { TranslationLine } from '@/components/translation/TranslationLine';

type TranslationFor = (seq: number) => SegmentTranslation | undefined;

// Speaker pill styles; a speaker's color is stable across the meeting (hash of name).
const CHIP_STYLES = [
  'bg-zinc-100 text-zinc-700',
  'bg-teal-100 text-teal-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
];

function chipFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return CHIP_STYLES[Math.abs(hash) % CHIP_STYLES.length];
}

function formatTime(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return '';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface SpeakerGroup {
  name: string;
  startSec: number | null;
  lines: { seq: number; text: string }[];
}

/** Merge consecutive segments from the same speaker into one reading block. */
function groupBySpeaker(segments: DiarizedSegment[]): SpeakerGroup[] {
  const groups: SpeakerGroup[] = [];
  for (const seg of segments) {
    const name = seg.speaker_name?.trim() || 'Unknown';
    const last = groups[groups.length - 1];
    if (last && last.name === name) {
      last.lines.push({ seq: seg.seq, text: seg.text });
    } else {
      groups.push({ name, startSec: seg.start_sec ?? null, lines: [{ seq: seg.seq, text: seg.text }] });
    }
  }
  return groups;
}

const GroupBlock = memo(function GroupBlock({
  group,
  translationFor,
}: {
  group: SpeakerGroup;
  translationFor?: TranslationFor;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[12.5px] font-semibold ${chipFor(group.name)}`}>
          {group.name}
        </span>
        {group.startSec !== null && (
          <span className="text-[11.5px] tabular-nums text-zinc-400">{formatTime(group.startSec)}</span>
        )}
      </div>
      {group.lines.map(({ seq, text }) => {
        const rtl = rtlTextProps(text);
        return (
          <div key={seq}>
            <p dir={rtl.dir} className={`mt-1.5 text-sm leading-7 text-zinc-700 ${rtl.className}`}>
              {text}
            </p>
            <TranslationLine translation={translationFor?.(seq)} />
          </div>
        );
      })}
    </div>
  );
});

/** Who-said-what reading pane for the diarized transcript (mockups 2i / 2r). */
export default function SpeakerTranscript({
  segments,
  translationFor,
}: {
  segments: DiarizedSegment[];
  translationFor?: TranslationFor;
}) {
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
        <GroupBlock key={i} group={group} translationFor={translationFor} />
      ))}
    </div>
  );
}

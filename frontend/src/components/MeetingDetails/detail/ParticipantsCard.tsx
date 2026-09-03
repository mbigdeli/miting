'use client';

import type { SpeakerStat } from './meetingFacts';

const SECTION_HEADING =
  'mb-2.5 mt-6 text-[13px] font-semibold uppercase tracking-[.4px] text-zinc-600';

/** Participants with talk-time share bars, from the diarized transcript (mockup 2w). */
export default function ParticipantsCard({ stats }: { stats: SpeakerStat[] }) {
  if (stats.length === 0) return null;
  return (
    <section>
      <h3 className={SECTION_HEADING}>Participants · {stats.length}</h3>
      <div className="overflow-hidden rounded-[10px] border border-zinc-200 bg-white">
        {stats.map((s, i) => (
          <div
            key={s.name}
            className={`grid grid-cols-[1fr_92px] items-center gap-3 px-4 py-3 ${
              i < stats.length - 1 ? 'border-b border-zinc-100' : ''
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-700">
                {s.initials}
              </span>
              <div className="truncate text-[13.5px] font-medium text-zinc-900">{s.name}</div>
            </div>
            <div className="text-right">
              <div className="text-[12.5px] tabular-nums text-zinc-700">{s.share}%</div>
              <div className="ml-auto mt-1 h-1 w-16 rounded-full bg-teal-100">
                <div
                  className="h-1 rounded-full bg-brand"
                  style={{ width: `${Math.min(s.share, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export { SECTION_HEADING };

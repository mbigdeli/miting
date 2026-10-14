'use client';

import { liveTag, useLiveSpeakerTurns } from '@/lib/liveSpeakers';

/** Who is speaking at `at` seconds, once the live speaker pass knows. */
export function LiveSpeakerTag({ at }: { at: number }) {
  const turns = useLiveSpeakerTurns();
  const tag = liveTag(turns, at, at + 1);
  if (!tag) return null;
  return <div className="mb-0.5 text-[11.5px] font-medium text-zinc-400">{tag}</div>;
}

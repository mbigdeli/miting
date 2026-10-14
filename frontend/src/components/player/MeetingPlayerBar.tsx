'use client';

import { Pause, Play } from 'lucide-react';
import { cardMoment } from '@/lib/notes/anchor';
import { clock } from '@/lib/notes/detect';
import { useNotes } from '../notes/NotesContext';
import { useMeetingAudio } from './MeetingAudio';

/**
 * Play/pause, a scrubber with a pin for every note, and the time. The
 * Transcript tab shows it sticky above the lines; Details shows it as the
 * Recording card.
 */
export function MeetingPlayerBar({ fallbackDuration = 0 }: { fallbackDuration?: number }) {
  const audio = useMeetingAudio();
  const notes = useNotes();
  if (!audio) return null;
  if (audio.missing) return <p className="text-[12.5px] text-zinc-500">No audio saved for this miting.</p>;
  if (!audio.available) return <p className="text-[12.5px] text-zinc-400">Loading the recording…</p>;

  // Never shorter than the transcript or the playhead (metadata can be late or wrong).
  const total = Math.max(audio.duration, fallbackDuration, audio.time, 1);
  const pct = (sec: number) => `${Math.min(100, Math.max(0, (sec / total) * 100))}%`;
  const pins = (notes?.cards ?? []).map(cardMoment).filter((s): s is number => s !== null);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={audio.toggle}
        aria-label={audio.playing ? 'Pause' : 'Play'}
        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-zinc-900 text-white hover:bg-zinc-800"
      >
        {audio.playing ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" className="ml-0.5" />}
      </button>
      <div
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(audio.time)}
        tabIndex={0}
        className="relative h-1 flex-1 cursor-pointer rounded bg-zinc-200 before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          audio.seek(((e.clientX - r.left) / r.width) * total);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') audio.seek(audio.time + 5, false);
          if (e.key === 'ArrowLeft') audio.seek(audio.time - 5, false);
        }}
      >
        <div className="absolute inset-y-0 left-0 rounded bg-zinc-900" style={{ width: pct(audio.time) }} />
        {pins.map((sec, i) => (
          <span key={i} className="absolute -top-2 h-[7px] w-[3px] rounded-sm bg-[#D6BE8A]" style={{ left: pct(sec) }} />
        ))}
      </div>
      <span className="shrink-0 text-[12px] tabular-nums text-zinc-500">
        {clock(audio.time)} / {clock(total)}
      </span>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import type { MeetingSpeakers } from '@/hooks/meeting-details/useMeetingSpeakers';
import { hasMeetNames, isAcoustic, stageText } from '@/lib/speakers';
import SpeakerRow from './SpeakerRow';
import { useSamplePlayer } from './useSamplePlayer';

interface Props {
  folderPath?: string | null;
  speakers: MeetingSpeakers;
}

const btn =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-[12.5px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50';

/** Who spoke: identify voices locally, review AI names, rename, merge (doc 18). */
export default function SpeakersCard({ folderPath, speakers: s }: Props) {
  const player = useSamplePlayer(folderPath);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const list = s.speakers;
  const progress = stageText(s.stage);
  const canRun = !hasMeetNames(list) && !!folderPath;

  const start = () => {
    setConfirmRerun(false);
    void s.identify();
  };

  return (
    <section className="mb-5 overflow-hidden rounded-[10px] border border-zinc-200 bg-white">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5">
        <Users size={15} className="text-zinc-500" />
        <h3 className="text-[13px] font-semibold text-zinc-800">
          Speakers{list.length > 0 ? ` · ${list.length}` : ''}
        </h3>
        {canRun && !progress && list.length === 0 && (
          <button type="button" className={`${btn} ml-auto`} onClick={start}>
            Identify speakers
          </button>
        )}
        {canRun && !progress && isAcoustic(list) && !confirmRerun && (
          <button type="button" className={`${btn} ml-auto`} onClick={() => setConfirmRerun(true)} title="Run speaker identification again">
            <RefreshCw size={13} /> Re-run
          </button>
        )}
      </div>

      {confirmRerun && (
        <div className="flex flex-wrap items-center gap-2 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">
          <span>Re-running replaces the names you set for this miting.</span>
          <button type="button" onClick={start} className="rounded-md bg-amber-900 px-2.5 py-1 font-medium text-white">
            Re-run
          </button>
          <button type="button" onClick={() => setConfirmRerun(false)} className="px-1 text-amber-800">
            Cancel
          </button>
        </div>
      )}

      {progress && (
        <div className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-zinc-600">
          <Loader2 size={14} className="animate-spin text-brand" />
          <span>{progress}</span>
          <span className="text-zinc-400">About 3 minutes per hour of audio.</span>
        </div>
      )}

      {s.error && !progress && <p className="px-4 py-3 text-[12.5px] text-red-600">{s.error}</p>}

      {list.length === 0 && !progress && !s.error && (
        <p className="px-4 py-3 text-[12.5px] leading-5 text-zinc-500">
          {canRun
            ? 'Find out who said what. Voices are told apart on this computer, then your AI suggests names it finds in the transcript.'
            : 'Speaker identification needs a saved recording.'}
        </p>
      )}

      <div className="divide-y divide-zinc-100">
        {list.map((sp) => (
          <SpeakerRow
            key={sp.name}
            speaker={sp}
            all={list}
            canListen={player.ready}
            playing={player.playing === sp.name}
            onListen={() => player.play(sp.name, sp.sample_start_sec ?? 0, sp.sample_end_sec ?? 0)}
            onRename={(to) => void s.rename(sp.name, to)}
            onConfirm={() => void s.confirm(sp.name)}
            onDismissMerge={() => void s.dismissMerge(sp.name)}
          />
        ))}
      </div>
    </section>
  );
}

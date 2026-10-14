'use client';

import { useState } from 'react';
import { Pencil, Play, Square } from 'lucide-react';
import { sideLabel, sourceBadge, talkShare, type SpeakerInfo } from '@/lib/speakers';
import { rtlTextProps } from '@/lib/rtl';
import { SpeakerMergeConfirm, SpeakerMergeHint, SpeakerMergePicker } from './SpeakerMerge';
import SpeakerNameEditor from './SpeakerNameEditor';

interface Props {
  speaker: SpeakerInfo;
  all: SpeakerInfo[];
  canListen: boolean;
  playing: boolean;
  onListen: () => void;
  onRename: (to: string) => void;
  onConfirm: () => void;
  onDismissMerge: () => void;
}

const iconBtn = 'grid h-8 w-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100';

/** One speaker: name (editable), where the name came from, talk share, Listen, Merge. */
export default function SpeakerRow({ speaker, all, canListen, playing, onListen, onRename, onConfirm, onDismissMerge }: Props) {
  const [editing, setEditing] = useState(false);
  const [mergeInto, setMergeInto] = useState('');
  const badge = sourceBadge(speaker.name_source);
  const side = sideLabel(speaker.side);
  const share = talkShare(speaker, all);
  const rtl = rtlTextProps(speaker.name);
  const hasSample = speaker.sample_start_sec !== null && speaker.sample_end_sec !== null;

  if (editing) {
    return (
      <div className="px-4 py-3">
        <SpeakerNameEditor
          speaker={speaker}
          all={all}
          onCancel={() => setEditing(false)}
          onSave={(to) => {
            setEditing(false);
            onRename(to);
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-1.5 px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          dir={rtl.dir}
          title="Rename"
          className={`truncate text-left text-[13.5px] font-medium ${
            speaker.name_source === 'auto' ? 'text-zinc-500' : 'text-zinc-900'
          } hover:underline`}
        >
          {speaker.name}
        </button>
        {badge && (
          <span
            title={speaker.ai_evidence ? `From the transcript: "${speaker.ai_evidence}"` : undefined}
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              speaker.name_source === 'ai' ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {badge}
          </span>
        )}
        {side && <span className="shrink-0 text-[11.5px] text-zinc-400">{side}</span>}
        <span className="ml-auto shrink-0 text-[12.5px] tabular-nums text-zinc-500">{share}%</span>
        {canListen && hasSample && (
          <button type="button" onClick={onListen} className={iconBtn} aria-label={`Listen to ${speaker.name}`} title="Listen">
            {playing ? <Square size={14} /> : <Play size={15} />}
          </button>
        )}
        <button type="button" onClick={() => setEditing(true)} className={iconBtn} aria-label={`Rename ${speaker.name}`} title="Rename">
          <Pencil size={14} />
        </button>
        <SpeakerMergePicker speaker={speaker} all={all} onPick={setMergeInto} />
      </div>
      {mergeInto && (
        <SpeakerMergeConfirm
          from={speaker.name}
          into={mergeInto}
          onCancel={() => setMergeInto('')}
          onMerge={() => {
            setMergeInto('');
            onRename(mergeInto);
          }}
        />
      )}
      {speaker.merge_into && !mergeInto && (
        <SpeakerMergeHint
          into={speaker.merge_into}
          evidence={speaker.merge_evidence ?? null}
          onMerge={() => onRename(speaker.merge_into as string)}
          onDismiss={onDismissMerge}
        />
      )}
      {speaker.name_source === 'ai' && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
          {speaker.ai_evidence && <span dir="auto" className="truncate">&ldquo;{speaker.ai_evidence}&rdquo;</span>}
          <button type="button" onClick={onConfirm} className="font-medium text-brand hover:underline">
            Keep this name
          </button>
        </div>
      )}
    </div>
  );
}

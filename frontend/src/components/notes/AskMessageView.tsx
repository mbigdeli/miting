'use client';

import { clock } from '@/lib/notes/detect';
import type { AskItem } from '@/lib/notes/types';
import { AskAnswer } from './AskAnswer';

/** One question (with any selected text quoted) and its answer. */
export function AskMessageView({
  item,
  live,
  onSeek,
  onSave,
}: {
  item: AskItem;
  live: boolean;
  onSeek?: (sec: number) => void;
  onSave: () => void;
}) {
  return (
    <div className="mb-[18px]">
      <div className="ml-7 rounded-[12px_12px_3px_12px] bg-[#F2F0F7] px-3 py-2 text-[13.5px] text-zinc-700" dir="auto">
        {item.quotes.map((q, i) => (
          <div key={i} className="mb-1 border-l-2 border-[#D9D3E8] pl-2 text-[12px] text-[#7C7590]">
            {clock(q.at)} “{q.quote}”
          </div>
        ))}
        {item.question}
      </div>
      <div className="mt-2">
        {item.pending && <span className="text-[13px] text-[#A8A2BD]">Thinking…</span>}
        {item.error && <span className="text-[13px] text-red-700">{item.error}</span>}
        {item.answerMd && <AskAnswer markdown={item.answerMd} onSeek={onSeek} />}
      </div>
      {live && item.askedAtSec !== null && (
        <div className="mt-0.5 text-[11px] text-zinc-400">asked at {clock(item.askedAtSec)}</div>
      )}
      {item.answerMd &&
        (item.savedNoteId ? (
          <div className="mt-1.5 text-[12px] text-[#7C6F9E]">✓ Added to notes</div>
        ) : (
          <button
            type="button"
            onClick={onSave}
            className="mt-1.5 rounded-md border border-[#E9E6F2] bg-white px-2 py-0.5 text-[12px] text-[#6B6385] hover:bg-[#FAF9FD]"
          >
            + Add to notes
          </button>
        ))}
    </div>
  );
}

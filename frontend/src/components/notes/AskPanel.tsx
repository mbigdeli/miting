'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AskMessageView } from './AskMessageView';
import { useNotes } from './NotesContext';

const LIVE_SUGGESTIONS = ['What did I miss?', 'Summarize the last 5 minutes', 'What was decided so far?'];
const SAVED_SUGGESTIONS = ['What was decided?', 'Who owns what?', 'Draft a follow-up email'];

/** The private Ask AI conversation, on the right of the recording or miting. */
export function AskPanel() {
  const notes = useNotes();
  const router = useRouter();
  const threadRef = useRef<HTMLDivElement>(null);
  const count = notes?.asks.length ?? 0;

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, notes?.asks]);

  if (!notes) return null;
  if (!notes.askOpen) {
    return (
      <button
        type="button"
        onClick={() => notes.setAskOpen(true)}
        className="absolute right-4 top-3 z-20 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[12.5px] text-[#5E5578] shadow-sm hover:bg-zinc-50"
      >
        ✦ Ask AI
      </button>
    );
  }
  const noAi = notes.ai && !notes.ai.ready;

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-zinc-100 bg-[#FCFCFD]">
      <div className="flex items-center gap-2 px-[18px] pb-2.5 pt-4 text-[14px] font-semibold text-zinc-700">
        ✦ Ask AI
        <span className="text-[11.5px] font-normal text-zinc-400">
          private{notes.ai?.provider ? ` · ${notes.ai.provider}` : ''}
        </span>
        <button
          type="button"
          aria-label="Hide Ask AI"
          onClick={() => notes.setAskOpen(false)}
          className="ml-auto rounded p-0.5 text-zinc-400 hover:text-zinc-700"
        >
          <X size={15} />
        </button>
      </div>
      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4 pt-1">
        {noAi && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-900">
            Connect an AI to ask about your mitings. Notes still work.
            <button
              type="button"
              onClick={() => router.push('/settings?tab=summaryModels')}
              className="mt-1 block font-medium underline"
            >
              Open Settings &gt; Summary
            </button>
          </div>
        )}
        {notes.asks.map((a) => (
          <AskMessageView
            key={a.id}
            item={a}
            live={notes.live}
            onSeek={notes.seek}
            onSave={() => notes.saveAskAsNote(a.id)}
          />
        ))}
        {count === 0 && !noAi && (
          <>
            <p className="py-1.5 text-[13px] text-zinc-400">
              Ask anything about this miting. Answers stay here and only go into your notes if you add them.
            </p>
            <div className="mt-2.5 flex flex-col items-start gap-1.5">
              {(notes.live ? LIVE_SUGGESTIONS : SAVED_SUGGESTIONS).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => notes.ask(q, [])}
                  className="rounded-full border border-[#E9E6F2] bg-white px-3 py-1 text-[12.5px] text-[#5E5578] hover:bg-[#FAF9FD]"
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { cardMoment } from '@/lib/notes/anchor';
import { clock } from '@/lib/notes/detect';
import type { NoteCard } from '@/lib/notes/types';
import { FormatButtons } from './FormatButtons';
import { useNotes } from './NotesContext';

/**
 * One note card. Click the text to edit it in place; every keystroke is saved.
 * Click outside or press Esc to close. Delete shows on hover.
 */
export const NoteCardView = memo(function NoteCardView({ card }: { card: NoteCard }) {
  const notes = useNotes();
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = editRef.current;
    if (!editing || !el) return;
    el.innerHTML = card.bodyHtml;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    // Only when editing starts: later renders must not reset the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!notes) return null;
  const close = () => {
    setEditing(false);
    notes.finishEditing(card.id);
  };
  const fromAi = card.source === 'ask';
  const moment = cardMoment(card);

  return (
    <div
      data-note-card
      className={`group relative rounded-[10px] border px-3 py-2 text-[14px] ${
        editing ? 'border-[#D9CDB0] bg-white shadow-[0_0_0_3px_#F6F1E6]' : 'border-[#EFE8D8] bg-[#FDFCF8] hover:border-[#E3D9C3]'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#9A7B4F]">
        <span>{fromAi ? '✦ From Ask AI' : '✎ Note'}</span>
        {moment !== null && (
          <button
            type="button"
            disabled={!notes.seek}
            onClick={() => notes.seek?.(moment)}
            className="font-normal tabular-nums text-zinc-400 enabled:hover:text-zinc-700"
          >
            {clock(moment)}
          </button>
        )}
        {card.edited && <span className="font-normal text-[#B4ADA0]">· edited</span>}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => notes.deleteNote(card.id)}
          className={`ml-auto rounded-md px-1.5 py-0.5 text-[12px] font-normal text-[#8A8173] hover:bg-[#F3EFE6] hover:text-[#4A4235] ${
            editing ? '' : 'invisible group-hover:visible'
          }`}
        >
          Delete
        </button>
      </div>
      {card.quotes.map((q, i) => (
        <div key={i} className="mt-1 border-l-2 border-[#E8D3A2] pl-2 text-[12.5px] text-zinc-500">
          {clock(q.at)} “{q.quote}”
        </div>
      ))}
      {editing ? (
        <>
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            dir="auto"
            className="mt-1.5 rounded-md border border-[#E8E1D1] px-2 py-1.5 outline-none [unicode-bidi:plaintext] [&_ul]:list-disc [&_ul]:pl-5"
            onInput={(e) => notes.updateNote(card.id, e.currentTarget.innerHTML)}
            onBlur={close}
            onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          />
          <div className="mt-1.5 flex items-center">
            <FormatButtons />
            <span className="ml-auto text-[11px] text-[#B4ADA0]">Saved as you type</span>
          </div>
        </>
      ) : (
        <div
          dir="auto"
          onClick={() => setEditing(true)}
          className="mt-0.5 cursor-text text-zinc-900 [unicode-bidi:plaintext] [&_ul]:list-disc [&_ul]:pl-5"
          // Sanitized on every write (lib/notes/sanitize).
          dangerouslySetInnerHTML={{ __html: card.bodyHtml }}
        />
      )}
    </div>
  );
});

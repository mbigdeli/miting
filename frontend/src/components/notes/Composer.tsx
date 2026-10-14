'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { detectMode } from '@/lib/notes/detect';
import { noteText } from '@/lib/notes/sanitize';
import type { ComposerMode } from '@/lib/notes/types';
import { ContextChips } from './ContextChips';
import { FormatButtons } from './FormatButtons';
import { useNotes } from './NotesContext';

/**
 * The one box at the bottom: a statement becomes a note, a question goes to
 * Ask AI. The chip shows which; Tab or a click switches it. Selected
 * transcript text rides along as context chips.
 */
export function Composer({ onSummary = false }: { onSummary?: boolean }) {
  const notes = useNotes();
  const inputRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ComposerMode>('note');
  const [forced, setForced] = useState(false);
  const [empty, setEmpty] = useState(true);

  const focus = useCallback(() => inputRef.current?.focus(), []);
  useEffect(() => notes?.registerFocus(focus), [notes, focus]);
  if (!notes) return null;

  const reset = () => {
    if (inputRef.current) inputRef.current.innerHTML = '';
    setEmpty(true);
    setMode('note');
    setForced(false);
    notes.clearChips();
  };
  const send = () => {
    const el = inputRef.current;
    if (!el) return;
    const text = noteText(el.innerHTML);
    if (!text) return;
    if (mode === 'ask') notes.ask(el.innerText.trim(), notes.chips);
    else notes.addNote(el.innerHTML, notes.chips);
    reset();
  };
  const toggle = () => {
    setMode((m) => (m === 'note' ? 'ask' : 'note'));
    setForced(true);
    focus();
  };

  const placeholder =
    mode === 'ask'
      ? notes.chips.length
        ? 'Ask about the selected text…'
        : 'Ask about this miting…'
      : notes.chips.length
        ? 'Note about the selected text…'
        : 'Write a note… or ask a question with ?';

  return (
    <div className="rounded-[14px] border border-zinc-200 bg-white px-2.5 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
      <ContextChips chips={notes.chips} onRemove={notes.removeChip} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          title="Tab to switch"
          className={`h-[30px] shrink-0 rounded-lg px-2.5 text-[12.5px] font-semibold ${
            mode === 'note' ? 'bg-[#F6F3EC] text-[#7A6440]' : 'bg-[#F2F0F7] text-[#5E5578]'
          }`}
        >
          {mode === 'note' ? '✎ Note' : '✦ Ask'}
        </button>
        <div className="relative min-w-0 flex-1">
          {empty && (
            <span className="pointer-events-none absolute left-0.5 top-[5px] text-[14px] text-zinc-400">
              {placeholder}
            </span>
          )}
          <div
            ref={inputRef}
            contentEditable
            suppressContentEditableWarning
            dir="auto"
            aria-label={onSummary ? 'Write a note or ask about this miting' : 'Write a note or ask a question'}
            className="max-h-32 min-h-[30px] overflow-y-auto px-0.5 py-[5px] text-[14px] outline-none [unicode-bidi:plaintext] [&_ul]:list-disc [&_ul]:pl-5"
            onInput={(e) => {
              const t = e.currentTarget.innerText;
              setEmpty(!t.trim());
              if (!forced) setMode(detectMode(t));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                toggle();
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
        </div>
        {mode === 'note' && <FormatButtons />}
        <button
          type="button"
          onClick={send}
          aria-label={mode === 'ask' ? 'Ask' : 'Add note'}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-700 text-white hover:bg-zinc-800"
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </div>
  );
}

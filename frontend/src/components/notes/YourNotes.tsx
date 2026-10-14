'use client';

import { cardMoment } from '@/lib/notes/anchor';
import { NoteCardView } from './NoteCardView';
import { useNotes } from './NotesContext';

/** Under the summary: every note on the miting in time order, still editable. */
export function YourNotes() {
  const notes = useNotes();
  if (!notes || notes.cards.length === 0) return null;
  const cards = [...notes.cards].sort((a, b) => (cardMoment(a) ?? Infinity) - (cardMoment(b) ?? Infinity));
  return (
    <section className="mt-8 border-t border-zinc-100 pt-5">
      <h3 className="mb-3 text-[15px] font-semibold text-zinc-900">Your notes</h3>
      <div className="grid gap-2">
        {cards.map((c) => (
          <NoteCardView key={c.id} card={c} />
        ))}
      </div>
    </section>
  );
}

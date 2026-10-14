'use client';

import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { cardsByLine } from '@/lib/notes/anchor';
import { type HighlightKind, splitHighlights } from '@/lib/notes/highlight';
import type { LineRef, NoteCard } from '@/lib/notes/types';
import { NoteCardView } from './NoteCardView';
import { useNotes } from './NotesContext';

interface DecorApi {
  cardsFor: (lineKey: string) => NoteCard[];
  quotes: { quote: string; kind: HighlightKind }[];
  /** The line being played (saved mitings). */
  activeKey: string | null;
  seek?: (sec: number) => void;
}

const DecorContext = createContext<DecorApi | null>(null);

/** Gives every transcript line below it its note cards, tints and play state. */
export function TranscriptDecorProvider({
  lines,
  activeKey = null,
  children,
}: {
  lines: LineRef[];
  activeKey?: string | null;
  children: ReactNode;
}) {
  const notes = useNotes();
  const value = useMemo<DecorApi | null>(() => {
    if (!notes) return activeKey ? { cardsFor: () => [], quotes: [], activeKey } : null;
    const byLine = cardsByLine(lines, notes.cards);
    const saved = [...notes.cards.flatMap((c) => c.quotes), ...notes.asks.flatMap((a) => a.quotes)];
    return {
      cardsFor: (key) => byLine.get(key) ?? [],
      quotes: [
        ...saved.map((q) => ({ quote: q.quote, kind: 'saved' as const })),
        ...notes.chips.map((q) => ({ quote: q.quote, kind: 'pending' as const })),
      ],
      activeKey,
      seek: notes.seek,
    };
  }, [notes, lines, activeKey]);
  return (
    <DecorContext.Provider value={value}>
      <div data-notes-transcript className="contents">
        {children}
      </div>
    </DecorContext.Provider>
  );
}

export function useTranscriptDecor(): DecorApi | null {
  return useContext(DecorContext);
}

/** A line's text with selected and quoted words tinted. */
export function LineText({ text }: { text: string }) {
  const decor = useTranscriptDecor();
  if (!decor || decor.quotes.length === 0) return <>{text}</>;
  return (
    <>
      {splitHighlights(text, decor.quotes).map((p, i) =>
        p.kind ? (
          <mark
            key={i}
            className={
              p.kind === 'pending'
                ? 'rounded-sm bg-[#EEF0F6] text-inherit shadow-[0_1.5px_0_#B9BED0]'
                : 'rounded-sm bg-[#FBF6EA] text-inherit shadow-[0_1.5px_0_#E8D3A2]'
            }
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

/** Note cards that belong under a line. */
export function LineCards({ lineKey }: { lineKey: string }) {
  const decor = useTranscriptDecor();
  const cards = decor?.cardsFor(lineKey) ?? [];
  if (cards.length === 0) return null;
  return (
    <div className="mt-1.5 grid gap-2">
      {cards.map((c) => (
        <NoteCardView key={c.id} card={c} />
      ))}
    </div>
  );
}

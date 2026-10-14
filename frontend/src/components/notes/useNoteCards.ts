'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteNote as removeNote, listNotes, upsertNote } from '@/lib/notes/api';
import { noteText, sanitizeNoteHtml } from '@/lib/notes/sanitize';
import type { NoteCard, Quote } from '@/lib/notes/types';
import { newId, type NotesSource } from './source';

const SAVE_DELAY_MS = 400;

/**
 * Note cards of one screen. Saved mitings write every change to the database
 * (edits are debounced per card); a recording keeps them in the page and the
 * caller mirrors them to local storage.
 */
export function useNoteCards(source: NotesSource, initial: NoteCard[]) {
  const [cards, setCards] = useState<NoteCard[]>(initial);
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>());
  const meetingId = source.live ? null : source.meetingId;

  useEffect(() => {
    if (!meetingId) return;
    let cancelled = false;
    listNotes(meetingId)
      .then((rows) => !cancelled && setCards(rows))
      .catch((e) => console.error('notes: load failed', e));
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  const persist = useCallback(
    (card: NoteCard, delay: number) => {
      if (!meetingId) return;
      const pending = timers.current.get(card.id);
      if (pending) clearTimeout(pending.timer);
      const run = () => {
        timers.current.delete(card.id);
        upsertNote(meetingId, card).catch((e) => console.error('notes: save failed', e));
      };
      if (delay === 0) run();
      else timers.current.set(card.id, { timer: setTimeout(run, delay), run });
    },
    [meetingId]
  );

  const addCard = useCallback(
    (bodyHtml: string, quotes: Quote[], atSec: number | null, source: NoteCard['source'] = 'user') => {
      const card: NoteCard = { id: newId(), atSec, bodyHtml: sanitizeNoteHtml(bodyHtml), quotes, source, edited: false };
      setCards((cs) => [...cs, card]);
      persist(card, 0);
      return card;
    },
    [persist]
  );

  const updateCard = useCallback(
    (id: string, bodyHtml: string) => {
      setCards((cs) =>
        cs.map((c) => {
          if (c.id !== id) return c;
          const next = { ...c, bodyHtml: sanitizeNoteHtml(bodyHtml), edited: true };
          persist(next, SAVE_DELAY_MS);
          return next;
        })
      );
    },
    [persist]
  );

  const deleteCard = useCallback(
    (id: string) => {
      const pending = timers.current.get(id);
      if (pending) clearTimeout(pending.timer);
      timers.current.delete(id);
      setCards((cs) => cs.filter((c) => c.id !== id));
      if (meetingId) removeNote(meetingId, id).catch((e) => console.error('notes: delete failed', e));
    },
    [meetingId]
  );

  /** Closing an emptied card removes it. */
  const finishEditing = useCallback(
    (id: string) => {
      const card = cards.find((c) => c.id === id);
      if (card && !noteText(card.bodyHtml)) deleteCard(id);
    },
    [cards, deleteCard]
  );

  // Leaving the screen sends edits still waiting for their delay.
  useEffect(() => {
    const map = timers.current;
    return () =>
      map.forEach(({ timer, run }) => {
        clearTimeout(timer);
        run();
      });
  }, []);

  return { cards, setCards, addCard, updateCard, deleteCard, finishEditing };
}

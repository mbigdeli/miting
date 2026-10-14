'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNotesEnabled } from '@/lib/notes/enabled';
import { loadLive, saveLive } from '@/lib/notes/liveStore';
import { answerToNoteHtml } from '@/lib/notes/sanitize';
import type { Quote } from '@/lib/notes/types';
import { type AiStatus, type NotesApi, NotesContext } from './NotesContext';
import type { NotesSource } from './source';
import { useAskThread } from './useAskThread';
import { useNoteCards } from './useNoteCards';
import { useSelectionChips } from './useSelectionChips';

/**
 * Notes and Ask AI for one screen (the recording, or a saved miting). Give a
 * live provider `key={session}` so a new recording starts clean.
 */
export function NotesProvider({
  source,
  playerTime,
  seek,
  children,
}: {
  source: NotesSource;
  /** Saved mitings: where the player is (null before it was played). */
  playerTime?: () => number | null;
  seek?: (sec: number) => void;
  children: ReactNode;
}) {
  const enabled = useNotesEnabled();
  const [initial] = useState(() => (source.live ? loadLive(source.session) : null));
  const notes = useNoteCards(source, initial?.cards ?? []);
  const thread = useAskThread(source, notes.cards, { asks: initial?.asks ?? [], earlier: initial?.earlier ?? null });
  const [askOpen, setAskOpen] = useState(true);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const focusRef = useRef<() => void>(() => {});
  const focusComposer = useCallback(() => focusRef.current(), []);
  const chips = useSelectionChips(focusComposer);

  const liveSession = source.live ? source.session : null;
  useEffect(() => {
    if (liveSession) saveLive({ session: liveSession, cards: notes.cards, asks: thread.asks, earlier: thread.earlier });
  }, [liveSession, notes.cards, thread.asks, thread.earlier]);

  useEffect(() => {
    invoke<AiStatus>('translation_ai_status')
      .then(setAi)
      .catch(() => setAi({ ready: false, provider: null, reason: 'no_ai_configured' }));
  }, []);

  const now = useCallback(
    () => (source.live ? source.clock() : (playerTime?.() ?? null)),
    [source, playerTime]
  );
  const { addCard, updateCard, deleteCard } = notes;
  const { ask: askAi, markSaved, asks } = thread;

  const value = useMemo<NotesApi>(
    () => ({
      live: source.live,
      meetingId: source.live ? null : source.meetingId,
      cards: notes.cards,
      asks,
      chips: chips.chips,
      ai,
      askOpen,
      setAskOpen,
      now,
      addNote: (html: string, quotes: Quote[]) => addCard(html, quotes, now()),
      updateNote: updateCard,
      deleteNote: deleteCard,
      finishEditing: notes.finishEditing,
      ask: (q: string, quotes: Quote[]) => {
        setAskOpen(true);
        void askAi(q, quotes);
      },
      saveAskAsNote: (askId: string) => {
        const a = asks.find((x) => x.id === askId);
        if (!a?.answerMd || a.savedNoteId) return;
        const at = a.askedAtSec ?? a.quotes[0]?.at ?? null;
        const card = addCard(answerToNoteHtml(a.question, a.answerMd), a.quotes, at, 'ask');
        markSaved(askId, card.id);
      },
      addChip: chips.add,
      removeChip: chips.remove,
      clearChips: chips.clear,
      registerFocus: (f: () => void) => {
        focusRef.current = f;
      },
      seek,
    }),
    [source, notes.cards, notes.finishEditing, asks, chips, ai, askOpen, now, addCard, updateCard, deleteCard, askAi, markSaved, seek]
  );

  if (!enabled) return <>{children}</>;
  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

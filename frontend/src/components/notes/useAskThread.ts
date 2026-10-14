'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { askMeeting, listAsks, markAskSaved } from '@/lib/notes/api';
import { askErrorText } from '@/lib/notes/highlight';
import { LIVE_ASK_EVENT, loadLive, markInflight, resolveLiveAsk } from '@/lib/notes/liveStore';
import type { AskItem, EarlierSummary, NoteCard, Quote } from '@/lib/notes/types';
import { newId, type NotesSource } from './source';

/**
 * The Ask AI conversation of one screen. Saved mitings load and store it in
 * the database (the command does the storing); a recording keeps it in the
 * page together with the running summary of earlier lines.
 */
export function useAskThread(
  source: NotesSource,
  cards: NoteCard[],
  initial: { asks: AskItem[]; earlier: EarlierSummary | null }
) {
  const [asks, setAsks] = useState<AskItem[]>(initial.asks);
  const [earlier, setEarlier] = useState<EarlierSummary | null>(initial.earlier);
  const meetingId = source.live ? null : source.meetingId;
  // Latest values for the async ask without re-creating it on every change.
  const latest = useRef({ asks, earlier, cards, source });
  latest.current = { asks, earlier, cards, source };

  useEffect(() => {
    if (!meetingId) return;
    let cancelled = false;
    listAsks(meetingId)
      .then((rows) => !cancelled && setAsks(rows))
      .catch((e) => console.error('ask: load failed', e));
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  // Live: an answer that lands while this screen was away is in storage;
  // reload the conversation when it is announced.
  const liveSession = source.live ? source.session : null;
  useEffect(() => {
    if (!liveSession) return;
    const onAnswer = (e: Event) => {
      if ((e as CustomEvent<{ session: string }>).detail?.session !== liveSession) return;
      const v = loadLive(liveSession);
      setAsks(v.asks);
      setEarlier(v.earlier);
    };
    window.addEventListener(LIVE_ASK_EVENT, onAnswer);
    return () => window.removeEventListener(LIVE_ASK_EVENT, onAnswer);
  }, [liveSession]);

  const ask = useCallback(async (question: string, quotes: Quote[]) => {
    const { source: src, asks: history, cards: notes, earlier: summary } = latest.current;
    const tempId = `pending-${newId()}`;
    const item: AskItem = {
      id: tempId,
      askedAtSec: src.live ? src.clock() : null,
      question,
      quotes,
      answerMd: null,
      citations: [],
      error: null,
      provider: null,
      model: null,
      savedNoteId: null,
      pending: true,
    };
    if (src.live) markInflight(tempId);
    setAsks((a) => [...a, item]);
    try {
      const live = src.live
        ? {
            title: src.title,
            lines: src.lines(),
            nowSec: src.clock(),
            notes,
            history: history.filter((h) => h.answerMd && !h.pending),
            earlierSummary: summary,
          }
        : null;
      const reply = await askMeeting(src.live ? null : src.meetingId, live, question, quotes);
      if (src.live) resolveLiveAsk(src.session, tempId, () => reply.message, reply.earlierSummary);
      setAsks((a) => a.map((x) => (x.id === tempId ? reply.message : x)));
      if (reply.earlierSummary) setEarlier(reply.earlierSummary);
    } catch (e) {
      const error = askErrorText(String(e));
      if (src.live) resolveLiveAsk(src.session, tempId, (x) => ({ ...x, pending: false, error }));
      setAsks((a) => a.map((x) => (x.id === tempId ? { ...x, pending: false, error } : x)));
    }
  }, []);

  const markSaved = useCallback(
    (askId: string, noteId: string) => {
      setAsks((a) => a.map((x) => (x.id === askId ? { ...x, savedNoteId: noteId } : x)));
      if (meetingId) markAskSaved(meetingId, askId, noteId).catch((e) => console.error('ask: mark saved', e));
    },
    [meetingId]
  );

  return { asks, earlier, ask, markSaved };
}

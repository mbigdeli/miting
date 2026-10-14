import { invoke } from '@tauri-apps/api/core';
import type { AskLine, AskMessage, AskReply, EarlierSummary, NoteCard, Quote } from './types';
import { clearLive, peekLive } from './liveStore';

export const listNotes = (meetingId: string) => invoke<NoteCard[]>('notes_list', { meetingId });
export const upsertNote = (meetingId: string, card: NoteCard) => invoke<void>('notes_upsert', { meetingId, card });
export const deleteNote = (meetingId: string, id: string) => invoke<void>('notes_delete', { meetingId, id });
export const listAsks = (meetingId: string) => invoke<AskMessage[]>('ask_list', { meetingId });
export const markAskSaved = (meetingId: string, askId: string, noteId: string) =>
  invoke<void>('ask_mark_saved', { meetingId, askId, noteId });

export interface LiveAskContext {
  title: string;
  lines: AskLine[];
  nowSec: number;
  notes: NoteCard[];
  history: AskMessage[];
  earlierSummary: EarlierSummary | null;
}

/** Ask about a saved miting (`live` null) or the recording in progress. */
export const askMeeting = (meetingId: string | null, live: LiveAskContext | null, question: string, quotes: Quote[]) =>
  invoke<AskReply>('ask_meeting', { meetingId, live, question, quotes });

/** After a recording is saved: store its notes and questions with the miting. */
export async function importLiveNotes(meetingId: string): Promise<void> {
  const live = peekLive();
  if (!live) return;
  if (live.cards.length === 0 && live.asks.length === 0) return clearLive();
  const asks = live.asks.filter((a) => a.answerMd && !a.pending).map(({ pending: _p, ...a }) => a);
  try {
    await invoke('notes_import_live', { meetingId, notes: live.cards, asks });
    clearLive();
  } catch (e) {
    // Kept in storage rather than lost; the error is logged for support.
    console.error('Could not store the notes taken during the recording', e);
  }
}

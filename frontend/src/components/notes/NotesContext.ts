'use client';

import { createContext, useContext } from 'react';
import type { AskItem, NoteCard, Quote } from '@/lib/notes/types';

export interface AiStatus {
  ready: boolean;
  provider: string | null;
  reason: string | null;
}

export interface NotesApi {
  live: boolean;
  meetingId: string | null;
  cards: NoteCard[];
  asks: AskItem[];
  chips: Quote[];
  ai: AiStatus | null;
  askOpen: boolean;
  setAskOpen: (open: boolean) => void;
  /** Recording clock while live; player position (or null) afterwards. */
  now: () => number | null;
  addNote: (bodyHtml: string, quotes: Quote[]) => void;
  updateNote: (id: string, bodyHtml: string) => void;
  deleteNote: (id: string) => void;
  /** A card closed; an emptied card is removed. */
  finishEditing: (id: string) => void;
  ask: (question: string, quotes: Quote[]) => void;
  saveAskAsNote: (askId: string) => void;
  addChip: (q: Quote) => void;
  removeChip: (index: number) => void;
  clearChips: () => void;
  /** The composer registers how to focus itself. */
  registerFocus: (focus: () => void) => void;
  seek?: (sec: number) => void;
}

export const NotesContext = createContext<NotesApi | null>(null);

/** Notes on this screen, or null where notes are off or not offered. */
export function useNotes(): NotesApi | null {
  return useContext(NotesContext);
}

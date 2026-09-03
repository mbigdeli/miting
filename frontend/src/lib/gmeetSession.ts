/**
 * The Google Meet session the companion extension started, if any.
 *
 * `GmeetGraceController` stores these before it asks the recorder to start, so
 * the recording path can tell a Meet-driven session apart from a normal one:
 * Meet supplies the captions, so the app records audio only and never spins up
 * a transcription engine.
 */

import type { TranscriptSource } from '@/services/recordingService';

const SESSION_KEY = 'gmeet_session_id';
const TITLE_KEY = 'gmeet_title';

const read = (key: string): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

/** True while a Meet-driven recording session is set up. */
export const isGmeetSession = (): boolean => !!read(SESSION_KEY);

/** Title of the Meet tab, when the extension sent one. */
export const gmeetTitle = (): string | null => read(TITLE_KEY);

/** Which source the next `startRecording` call should declare. */
export const gmeetTranscriptSource = (): TranscriptSource =>
  isGmeetSession() ? 'companion' : 'local';

/**
 * Name this session should carry. A Meet has a real title; falling back to the
 * generated `Miting <timestamp>` name for one made the meetings list useless
 * for finding a call back.
 */
export function gmeetMeetingName(fallback: string): string {
  const title = gmeetTitle()?.trim();
  return isGmeetSession() && title ? title : fallback;
}

/** Short status line for the record screen, e.g. shown instead of a transcript. */
export function gmeetRecordingNotice(title: string | null = gmeetTitle()): string {
  const trimmed = title?.trim();
  return trimmed
    ? `Recording from Google Meet · ${trimmed}`
    : 'Recording from Google Meet';
}

/** Tauri commands behind speaker identification (see `src-tauri/src/speakers`). */
import { invoke } from '@tauri-apps/api/core';
import type { SpeakerInfo, SpeakerStage } from './speakers';

export const speakersApi = {
  /** Start a background run; false when one is already going. */
  identify: (meetingId: string) => invoke<boolean>('speakers_identify', { meetingId }),
  stage: (meetingId: string) => invoke<SpeakerStage | null>('speakers_stage', { meetingId }),
  list: (meetingId: string) => invoke<SpeakerInfo[]>('speakers_list', { meetingId }),
  /** Rename everywhere; an existing name merges the two speakers. */
  rename: (meetingId: string, from: string, to: string) =>
    invoke<void>('speakers_rename', { meetingId, from, to }),
  confirm: (meetingId: string, name: string) => invoke<void>('speakers_confirm', { meetingId, name }),
  dismissMerge: (meetingId: string, name: string) =>
    invoke<void>('speakers_dismiss_merge', { meetingId, name }),
  reassign: (meetingId: string, seqs: number[], speaker: string) =>
    invoke<void>('speakers_reassign', { meetingId, seqs, speaker }),
};

/**
 * Kick off identification after a local recording is saved. Fire and forget:
 * it runs in the background and the meeting page picks up the result.
 */
export function startSpeakerIdentification(meetingId: string): void {
  speakersApi.identify(meetingId).catch((e) => {
    console.warn('[speakers] could not start identification:', e);
  });
}

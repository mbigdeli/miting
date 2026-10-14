/**
 * Meet captions are translated under their row id moved above every local
 * sequence id. Mirrors `CAPTION_SEQ_BASE` in `translation/live/captions.rs`.
 */
export const CAPTION_SEQ_BASE = 2 ** 40;

export function captionSeq(captionId: number): number {
  return CAPTION_SEQ_BASE + captionId;
}

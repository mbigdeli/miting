/** One typewriter animation in flight: a snapshot of the row it animates. */
export interface StreamingSegment {
  id: string;
  fullText: string;
  visibleText: string;
}

/**
 * The animation snapshot only stands in for the text it was taken from. A
 * Google Meet caption GROWS under the same row id, and returning the snapshot
 * unconditionally froze the live view at the first few words until the next
 * speaker created a new row — the whole sentence then popped in at once.
 * Live content always beats a stale animation.
 */
export function displayTextFor(
  segment: { id: string; text: string },
  streaming: StreamingSegment | null,
): string {
  if (streaming && segment.id === streaming.id && segment.text === streaming.fullText) {
    return streaming.visibleText;
  }
  return segment.text;
}

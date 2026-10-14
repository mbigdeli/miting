/**
 * When the live transcript should follow new content. Only the user's own
 * scrolling (wheel, touch, keys, scrollbar) may stop it: content that grows
 * on its own (translations under a line, a caption that lengthens) must
 * never leave the view stuck mid-transcript.
 */

/** Pixels from the bottom that still count as "at the live edge". */
export const NEAR_BOTTOM_PX = 100;
/** A scroll this soon after user input is the user's doing. */
export const USER_INPUT_WINDOW_MS = 1000;

export interface ScrollBox {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function isNearBottom(box: ScrollBox): boolean {
  return box.scrollHeight - box.scrollTop - box.clientHeight <= NEAR_BOTTOM_PX;
}

/**
 * New follow state after a scroll event. Scrolls without recent user input
 * (ours, or layout growth) never change it.
 */
export function followAfterScroll(
  following: boolean,
  box: ScrollBox,
  now: number,
  lastUserInput: number
): boolean {
  if (now - lastUserInput > USER_INPUT_WINDOW_MS) return following;
  return isNearBottom(box);
}

/** Keys that scroll a focused container. */
export const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

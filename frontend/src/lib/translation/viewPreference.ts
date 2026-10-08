/**
 * Which translation a saved miting shows, per miting and device.
 * `undefined` = never chosen, `null` = original only, else a language code.
 */

const key = (meetingId: string) => `translationView:${meetingId}`;

export function loadView(meetingId: string): string | null | undefined {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(key(meetingId));
    if (raw === null) return undefined;
    return raw === '' ? null : raw;
  } catch {
    return undefined;
  }
}

export function saveView(meetingId: string, language: string | null): void {
  try {
    window.localStorage.setItem(key(meetingId), language ?? '');
  } catch {
    // Not fatal: the choice just won't stick.
  }
}

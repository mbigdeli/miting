/** Languages the user translated into recently, newest first (per device). */

const KEY = 'translationLanguageRecents';
const DEFAULTS = ['en', 'fa'];
const MAX = 3;

export function loadRecents(): string[] {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') && parsed.length) {
      return parsed.slice(0, MAX);
    }
  } catch {
    // Storage blocked or corrupt: defaults below.
  }
  return [...DEFAULTS];
}

export function rememberLanguage(code: string): string[] {
  const next = [code, ...loadRecents().filter((c) => c !== code)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Not fatal: the pills just won't remember.
  }
  return next;
}

/** Pills to offer: the selected language first, then recents, then defaults. */
export function pillLanguages(recents: string[], selected?: string | null, exclude: string[] = []): string[] {
  const order = [...(selected ? [selected] : []), ...recents, ...DEFAULTS];
  const out: string[] = [];
  for (const code of order) {
    if (!out.includes(code) && !exclude.includes(code)) out.push(code);
  }
  return out.slice(0, MAX);
}

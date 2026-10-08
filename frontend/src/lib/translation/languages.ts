import { LANGUAGE_OPTIONS } from '@/lib/summary-languages';

/** Translation targets: the same languages the AI writes summaries in. */
export const TRANSLATION_LANGUAGES = LANGUAGE_OPTIONS;

const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);

/** A language's own name ("فارسی", "Deutsch"), falling back to English. */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    if (name && name.toLowerCase() !== code.toLowerCase()) {
      return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
    }
  } catch {
    // Unknown to Intl: use the English label below.
  }
  return LANGUAGE_OPTIONS.find((o) => o.code === code)?.label ?? code;
}

export function isRtlLanguage(code: string | null | undefined): boolean {
  return !!code && RTL_LANGUAGES.has(code.split('-')[0].toLowerCase());
}

/** Names joined for a chip: "فارسی, English". */
export function languageList(codes: string[]): string {
  return codes.map(languageName).join(', ');
}

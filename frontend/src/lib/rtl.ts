/**
 * Persian/Arabic-script text handling for transcripts and summaries.
 *
 * Detection matches the companion extension's convention (U+0600–U+06FF).
 * RTL text renders right-to-left in Vazirmatn (self-hosted via next/font,
 * `font-vazir` in Tailwind), falling back to the Latin UI stack.
 */

const RTL_RE = /[؀-ۿ]/;

export function isRtlText(text: string): boolean {
  return RTL_RE.test(text);
}

/** dir + font/alignment classes for a text block, keyed off its content. */
export function rtlTextProps(text: string): { dir: 'rtl' | 'ltr'; className: string } {
  return isRtlText(text)
    ? { dir: 'rtl', className: 'font-vazir text-right' }
    : { dir: 'ltr', className: 'text-left' };
}

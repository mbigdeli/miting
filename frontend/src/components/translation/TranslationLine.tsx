'use client';

import { Languages } from 'lucide-react';
import type { SegmentTranslation } from '@/lib/translation/types';
import { rtlTextProps } from '@/lib/rtl';
import { isRtlLanguage } from '@/lib/translation/languages';

/**
 * The translation under a transcript line: a quieter second line with a small
 * languages mark, or a soft placeholder while it is being translated.
 */
export function TranslationLine({ translation }: { translation?: SegmentTranslation }) {
  if (!translation) return null;
  if (!translation.text) {
    if (!translation.pending) return null;
    const end = isRtlLanguage(translation.language) ? 'justify-end' : '';
    return (
      <div className={`mt-2 flex ${end}`} aria-label="Translating">
        <span className="block h-2.5 w-[58%] animate-pulse rounded-full bg-zinc-200" />
      </div>
    );
  }
  const rtl = rtlTextProps(translation.text);
  return (
    <div dir={rtl.dir} lang={translation.language} className={`mt-1 flex items-start gap-1.5 ${rtl.className}`}>
      <Languages size={13} className="mt-[5px] shrink-0 text-brand" aria-hidden="true" />
      <p className="text-[15px] leading-relaxed text-zinc-600">{translation.text}</p>
    </div>
  );
}

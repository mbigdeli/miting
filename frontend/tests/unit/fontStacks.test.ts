import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import tailwindConfig from '../../tailwind.config.js';

/**
 * House rule: Persian/Arabic text renders in Vazirmatn everywhere, with no
 * component opting in.
 *
 * The mechanism is CSS per-glyph fallback: the Latin faces declare Latin-only
 * unicode-ranges, so an Arabic codepoint falls past them into Vazirmatn, while
 * Latin never reaches it. That only works while the Latin families ship no
 * *unrestricted* face — next/font's `adjustFontFallback` otherwise appends a
 * size-adjusted local face with no unicode-range, and the system's Arabic
 * glyphs match it, which is exactly what used to swallow Persian text.
 *
 * Vazirmatn cannot simply lead the stacks instead: next/font emits Latin faces
 * for it too, so leading would hand all Latin text to Vazirmatn.
 */

const FAMILIES = (tailwindConfig as any).theme.extend.fontFamily as Record<string, string[]>;

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const globalsCss = read('../../src/app/globals.css');
const layoutTsx = read('../../src/app/layout.tsx');

describe('tailwind font stacks', () => {
  test.each(Object.keys(FAMILIES))('%s can reach Vazirmatn', (family) => {
    expect(FAMILIES[family]).toContain('var(--font-vazirmatn)');
  });

  test('the Latin faces still come first for Latin text', () => {
    expect(FAMILIES.sans[0]).toBe('var(--font-source-sans-3)');
    expect(FAMILIES.inter[0]).toBe('var(--font-inter)');
  });

  test('nothing sits between a Latin face and Vazirmatn', () => {
    // Any unrestricted family in between would claim the Arabic glyphs first.
    for (const key of ['sans', 'inter']) {
      const stack = FAMILIES[key];
      expect(stack[1]).toBe('var(--font-vazirmatn)');
    }
  });

  test('the explicit Persian utility still leads with Vazirmatn', () => {
    expect(FAMILIES.vazir[0]).toBe('var(--font-vazirmatn)');
  });

  test('every stack ends in a generic family', () => {
    for (const stack of Object.values(FAMILIES)) {
      expect(stack[stack.length - 1]).toBe('sans-serif');
    }
  });
});

/** Options passed to one `next/font` call, e.g. `Vazirmatn({ … })`. */
const fontOptions = (call: string): string => {
  const start = layoutTsx.indexOf(`${call}({`);
  expect(start, `${call}({ not found in layout.tsx`).toBeGreaterThan(-1);
  return layoutTsx.slice(start, layoutTsx.indexOf('})', start));
};

describe('next/font declarations', () => {
  test.each(['Source_Sans_3', 'Inter'])(
    '%s drops the unrestricted local fallback that swallowed Persian',
    (call) => {
      expect(fontOptions(call)).toContain('adjustFontFallback: false');
    },
  );

  test('Vazirmatn keeps its fallback — it is last, so it claims nothing early', () => {
    const options = fontOptions('Vazirmatn');
    expect(options).not.toContain('adjustFontFallback');
    expect(options).toContain("subsets: ['arabic']");
  });
});

describe('BlockNote font override', () => {
  const override = globalsCss.slice(globalsCss.indexOf('.bn-container.bn-container'));

  test('summary editor uses the same Latin-then-Vazirmatn ordering', () => {
    expect(override).toMatch(/font-family:\s*var\(--font-inter\),\s*var\(--font-vazirmatn\)/);
  });

  test('it redefines BlockNote’s own font variable, not just font-family', () => {
    // `.bn-container{font-family:var(--bn-font-family)}` ships with BlockNote;
    // leaving the variable alone lets its Latin-only stack back in.
    expect(override).toMatch(/--bn-font-family:\s*var\(--font-inter\)/);
  });

  test('the selector out-specifies BlockNote’s single-class rule', () => {
    // A plain `.bn-container` rule ties on specificity and loses, because the
    // library stylesheet is imported after globals.css.
    expect(globalsCss).toContain('.bn-container.bn-container');
    expect(globalsCss).toContain('.bn-default-styles.bn-default-styles');
  });

  test('override sits outside @layer so it beats the BlockNote stylesheet', () => {
    const overrideIndex = globalsCss.indexOf('.bn-container.bn-container');
    expect(overrideIndex).toBeGreaterThan(globalsCss.lastIndexOf('@layer'));
  });

  test('Persian summaries get right-to-left block alignment', () => {
    expect(globalsCss).toMatch(/\[dir='rtl'\]\s*\.bn-block-content/);
    expect(globalsCss).toMatch(/\[dir='rtl'\]\s*\.bn-editor\s*\{[^}]*direction:\s*rtl/);
  });
});

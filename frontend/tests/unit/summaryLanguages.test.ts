import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  LANGUAGE_OPTIONS,
  SUMMARY_LANGUAGE_COUNT,
  normaliseLanguageCode,
} from '../../src/lib/summary-languages';

/**
 * The onboarding headline advertises how many languages summaries can be
 * written in. That claim is only honest while the picker list and the Rust
 * `language_name_from_code` mapping agree — a code the backend cannot name
 * would be offered in the UI and then silently produce nothing.
 */

const processorRs = readFileSync(
  fileURLToPath(new URL('../../src-tauri/src/summary/processor.rs', import.meta.url)),
  'utf8',
);

const backendCodes = new Set(
  [...processorRs.matchAll(/^\s*"([a-z-]+)" => Some\(/gm)].map((m) => m[1]),
);

describe('summary language list', () => {
  test('the advertised count is derived, not hard-coded', () => {
    expect(SUMMARY_LANGUAGE_COUNT).toBe(LANGUAGE_OPTIONS.length);
  });

  test('every offered code has a backend name', () => {
    const missing = LANGUAGE_OPTIONS.map((o) => o.code).filter((code) => {
      // `zh-tw` is returned early by the Rust matcher, before the code table.
      if (code === 'zh-tw') return !processorRs.includes('"zh-tw" => return Some(');
      return !backendCodes.has(code);
    });
    expect(missing).toEqual([]);
  });

  test('no duplicate codes inflate the count', () => {
    const codes = LANGUAGE_OPTIONS.map((o) => o.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('the two engines we actually ship on are both offered', () => {
    const codes = LANGUAGE_OPTIONS.map((o) => o.code);
    expect(codes).toContain('fa');
    expect(codes).toContain('en');
  });

  test('region variants normalise onto an offered code', () => {
    expect(normaliseLanguageCode('fa_IR')).toBe('fa');
    expect(normaliseLanguageCode('en-GB')).toBe('en');
    expect(normaliseLanguageCode('kl')).toBeNull();
  });
});

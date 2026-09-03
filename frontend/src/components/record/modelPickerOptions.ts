/** Pure helpers for the record-screen transcription model picker. */

export type PickerProvider = 'whisper' | 'parakeet' | 'shenava';

export interface PickerModel {
  provider: PickerProvider;
  name: string;
  /** Human name when the engine provides one (Shenava does). */
  displayName?: string;
}

/** Saved config uses `localWhisper`; the engine commands use `whisper`. */
export const toConfigProvider = (p: PickerProvider): string =>
  p === 'whisper' ? 'localWhisper' : p;

export const fromConfigProvider = (p: string | undefined): string =>
  p === 'localWhisper' ? 'whisper' : (p ?? '');

export const modelKey = (provider: string, name: string) => `${provider}:${name}`;

const ENGINE_LABEL: Record<PickerProvider, string> = {
  whisper: 'Whisper',
  parakeet: 'Parakeet',
  shenava: 'Shenava',
};

/** "Whisper · large-v3", "Shenava · Koochik — FA" (Persian-only engine). */
export function optionLabel(m: PickerModel): string {
  const name = m.displayName || m.name;
  const fa = m.provider === 'shenava' ? ' — FA' : '';
  return `${ENGINE_LABEL[m.provider]} · ${name}${fa}`;
}

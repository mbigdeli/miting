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

/**
 * The plain engine name ("Parakeet"), which is all the setup steps ever show.
 * Only when two models of one engine are downloaded does the model name
 * follow ("Whisper · large-v3"), so the entries stay distinguishable.
 */
export function optionLabel(m: PickerModel, all: PickerModel[] = [m]): string {
  const engine = ENGINE_LABEL[m.provider];
  const siblings = all.filter((other) => other.provider === m.provider).length;
  return siblings > 1 ? `${engine} · ${m.displayName || m.name}` : engine;
}

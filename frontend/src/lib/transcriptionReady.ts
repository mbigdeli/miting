/**
 * Whether a recording can be transcribed with the saved choice, by the rule
 * the recorder itself applies: Parakeet and Whisper fall back to any model
 * of that engine on disk, Shenava needs the exact saved model, and any other
 * provider is refused for live recording.
 */

export interface SavedTranscription {
  /** The local engine the saved provider maps to, if any. */
  engine: 'parakeet' | 'whisper' | 'shenava' | undefined;
  model: string | undefined;
  /** Names of that engine's models already downloaded. */
  onDisk: string[];
}

export function transcriptionStepReady({ engine, model, onDisk }: SavedTranscription): boolean {
  if (!engine) return false;
  if (engine === 'shenava') return model !== undefined && onDisk.includes(model);
  return onDisk.length > 0;
}

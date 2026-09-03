/**
 * Human label for the engine + model that transcribed a meeting, from the
 * values stamped on the meeting row at save time. Falls back to null for
 * meetings that predate stamping — callers show an unknown state rather
 * than guessing from the CURRENT config (the old bug: every meeting was
 * labelled "Whisper" with today's model).
 */

const ENGINE_NAMES: Record<string, string> = {
  localWhisper: 'Whisper',
  whisper: 'Whisper',
  parakeet: 'Parakeet',
  shenava: 'Shenava',
};

export function transcriptionLabel(
  engine?: string | null,
  model?: string | null,
): string | null {
  if (!engine && !model) return null;
  const engineName = engine ? (ENGINE_NAMES[engine] ?? engine) : null;
  if (engineName && model) return `${engineName} · ${model}`;
  return engineName ?? model ?? null;
}

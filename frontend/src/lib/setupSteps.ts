/**
 * Pure rules behind the two setup steps (transcription, then AI notes) that
 * onboarding and the Home screen both show. Kept free of React and Tauri so
 * the node test suite can cover them.
 */

export type RowState =
  | { kind: 'idle' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'connecting' }
  | { kind: 'missingApp' }
  /** On disk but not the one in use: offer "Use". */
  | { kind: 'available' }
  /** In use (and on disk, or connected). */
  | { kind: 'done' }
  | { kind: 'error' };

/**
 * A row counts as a choice once its download is running or it is in use. A
 * sign in that is still running does not count: leaving the step then would
 * drop it, because the save only happens once the sign in finishes.
 */
export const isChosen = (state: RowState): boolean =>
  state.kind === 'downloading' || state.kind === 'done';

export interface DownloadRowInput {
  progress: number | null | undefined;
  onDisk: boolean;
  selected: boolean;
  failed: boolean;
}

/** State of a row whose action is a download (transcription models, Qwen). */
export function downloadRowState({ progress, onDisk, selected, failed }: DownloadRowInput): RowState {
  if (progress !== null && progress !== undefined) return { kind: 'downloading', progress };
  if (onDisk) return selected ? { kind: 'done' } : { kind: 'available' };
  return failed ? { kind: 'error' } : { kind: 'idle' };
}

/** Onboarding's main button names what is still missing until both steps are covered. */
export function continueLabel(transcriptionChosen: boolean, aiChosen: boolean): string {
  if (transcriptionChosen && aiChosen) return 'Continue';
  if (!transcriptionChosen && !aiChosen) return 'Pick one in each step';
  return transcriptionChosen ? 'Pick one in step 2' : 'Pick one in step 1';
}

export interface AiReadiness {
  provider: string | null;
  claudeConnected: boolean;
  codexConnected: boolean;
  builtinReady: boolean;
}

/** The AI step is done when the saved provider can write notes right now. */
export function aiStepReady({ provider, claudeConnected, codexConnected, builtinReady }: AiReadiness): boolean {
  if (!provider?.trim()) return false;
  if (provider === 'claude-code') return claudeConnected;
  if (provider === 'codex') return codexConnected;
  if (provider === 'builtin-ai') return builtinReady;
  // An API provider (Ollama, OpenAI, Groq…) was set up in Settings.
  return true;
}

const ENGINE_NAMES: Record<string, string> = {
  parakeet: 'Parakeet',
  localWhisper: 'Whisper',
  shenava: 'Shenava',
};

const AI_NAMES: Record<string, string> = {
  'claude-code': 'Claude',
  codex: 'ChatGPT',
  'builtin-ai': 'Qwen',
  ollama: 'Ollama',
  claude: 'Claude',
  openai: 'OpenAI',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

/** One line shown on Home in place of a finished transcription step. */
export function transcriptionDoneTitle(provider: string | undefined): string {
  const name = provider ? ENGINE_NAMES[provider] : undefined;
  return name ? `${name} is ready` : 'Transcription is ready';
}

/** One line shown on Home in place of a finished AI notes step. */
export function aiDoneTitle(provider: string | null): string {
  const name = provider ? AI_NAMES[provider] : undefined;
  if (!name) return 'AI notes are ready';
  const connected = provider === 'claude-code' || provider === 'codex';
  return connected ? `${name} is connected` : `${name} is ready`;
}

export interface HomeVisibility {
  transcriptionDone: boolean;
  aiDone: boolean;
  dismissed: boolean;
}

/**
 * Home keeps the steps until both are done. They cannot be hidden while no
 * transcription model exists, so an older dismissal never hides them then.
 */
export function homeStepsVisible({ transcriptionDone, aiDone, dismissed }: HomeVisibility): boolean {
  if (!transcriptionDone) return true;
  return !aiDone && !dismissed;
}

/** The X appears only after transcription works. */
export const canDismissHomeSteps = (transcriptionDone: boolean): boolean => transcriptionDone;

/** "English · 670 MB": a row's grey line, with the size only once it is known. */
export const rowSubtitle = (lead: string | undefined, size: string | undefined): string =>
  [lead, size].filter(Boolean).join(' · ');

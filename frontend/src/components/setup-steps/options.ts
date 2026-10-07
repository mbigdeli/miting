/**
 * Copy and identity of every option the setup steps offer. Sizes are not
 * here on purpose: each row reads its size from the same backend catalog
 * Settings uses.
 */

import {
  DEFAULT_PARAKEET_MODEL,
  DEFAULT_WHISPER_MODEL,
  RECOMMENDED_SHENAVA_MODEL,
} from '@/constants/modelDefaults';

export type MarkKind = 'nvidia' | 'openai' | 'shenava' | 'claude' | 'sparkles';
export type TranscriptionOptionId = 'parakeet' | 'whisper' | 'shenava';
export type AiOptionId = 'claude' | 'chatgpt' | 'qwen';

interface OptionCopy {
  title: string;
  /** Teal badge after the name. */
  tag?: string;
  /** First part of the grey line; the size follows it when known. */
  lead?: string;
  tip: string;
  mark: MarkKind;
}

export interface TranscriptionOption extends OptionCopy {
  id: TranscriptionOptionId;
  model: string;
  /** Provider id saved in transcript settings. */
  configProvider: 'parakeet' | 'localWhisper' | 'shenava';
}

export const TRANSCRIPTION_OPTIONS: TranscriptionOption[] = [
  {
    id: 'parakeet',
    model: DEFAULT_PARAKEET_MODEL,
    configProvider: 'parakeet',
    title: 'Parakeet',
    tag: 'Recommended',
    lead: 'English',
    mark: 'nvidia',
    tip: 'Fast and accurate for English and other European languages. Runs on your computer.',
  },
  {
    id: 'whisper',
    model: DEFAULT_WHISPER_MODEL,
    configProvider: 'localWhisper',
    title: 'Whisper',
    tag: 'Many languages',
    lead: 'Slower',
    mark: 'openai',
    tip: 'Handles about 100 languages, but is slower than Parakeet. Runs on your computer.',
  },
  {
    id: 'shenava',
    model: RECOMMENDED_SHENAVA_MODEL,
    configProvider: 'shenava',
    title: 'Shenava',
    tag: 'Persian',
    mark: 'shenava',
    tip: 'The most accurate for Persian. Understands Persian only. Runs on your computer.',
  },
];

export const AI_COPY: Record<AiOptionId, OptionCopy> = {
  claude: {
    title: 'Claude',
    lead: 'Uses your Claude plan',
    mark: 'claude',
    tip: 'Writes notes with your Claude plan through the Claude Code app. Meeting text is sent to Anthropic.',
  },
  chatgpt: {
    title: 'ChatGPT',
    lead: 'Uses your ChatGPT plan',
    mark: 'openai',
    tip: 'Writes notes with your ChatGPT plan through the Codex app. Meeting text is sent to OpenAI.',
  },
  qwen: {
    title: 'Qwen',
    tag: 'Private',
    lead: 'Free',
    mark: 'sparkles',
    tip: 'Free, and nothing leaves your computer. Notes are simpler and slower to write.',
  },
};

export const STEP_COPY = {
  transcription: {
    num: 1,
    title: 'Transcription',
    need: 'Turns your recordings into text.',
    needHome: 'Your meetings are saved as audio only.',
    moreLabel: 'More models',
    settingsTab: 'Transcriptionmodels',
  },
  ai: {
    num: 2,
    title: 'AI notes',
    need: 'Writes a summary and next steps after each meeting.',
    needHome: 'Your meetings get no notes yet.',
    moreLabel: 'More options',
    settingsTab: 'summaryModels',
  },
} as const;

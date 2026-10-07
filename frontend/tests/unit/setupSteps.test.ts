import { describe, expect, it } from 'vitest';
import {
  aiDoneTitle,
  aiStepReady,
  canDismissHomeSteps,
  continueLabel,
  downloadRowState,
  homeStepsVisible,
  isChosen,
  rowSubtitle,
  transcriptionDoneTitle,
} from '@/lib/setupSteps';

describe('isChosen', () => {
  it('counts a running download or the option in use', () => {
    expect(isChosen({ kind: 'downloading', progress: 10 })).toBe(true);
    expect(isChosen({ kind: 'done' })).toBe(true);
  });

  it('does not count a sign in that is still running, so leaving cannot drop it', () => {
    expect(isChosen({ kind: 'connecting' })).toBe(false);
  });

  it('does not count untouched, unused, failed or missing app rows', () => {
    expect(isChosen({ kind: 'idle' })).toBe(false);
    expect(isChosen({ kind: 'available' })).toBe(false);
    expect(isChosen({ kind: 'error' })).toBe(false);
    expect(isChosen({ kind: 'missingApp' })).toBe(false);
  });
});

describe('downloadRowState', () => {
  const base = { progress: undefined, onDisk: false, selected: false, failed: false };

  it('shows progress first, even for the selected model', () => {
    expect(downloadRowState({ ...base, progress: 42, selected: true })).toEqual({ kind: 'downloading', progress: 42 });
    expect(downloadRowState({ ...base, progress: 0 })).toEqual({ kind: 'downloading', progress: 0 });
  });

  it('separates the model in use from one that is only on disk', () => {
    expect(downloadRowState({ ...base, onDisk: true, selected: true })).toEqual({ kind: 'done' });
    expect(downloadRowState({ ...base, onDisk: true })).toEqual({ kind: 'available' });
  });

  it('offers a retry after a failure and a download otherwise', () => {
    expect(downloadRowState({ ...base, failed: true })).toEqual({ kind: 'error' });
    expect(downloadRowState({ ...base, progress: null })).toEqual({ kind: 'idle' });
  });
});

describe('continueLabel', () => {
  it('names the missing step until both have a choice', () => {
    expect(continueLabel(false, false)).toBe('Pick one in each step');
    expect(continueLabel(true, false)).toBe('Pick one in step 2');
    expect(continueLabel(false, true)).toBe('Pick one in step 1');
    expect(continueLabel(true, true)).toBe('Continue');
  });
});

describe('aiStepReady', () => {
  const base = { claudeConnected: false, codexConnected: false, builtinReady: false };

  it('needs a saved provider', () => {
    expect(aiStepReady({ ...base, provider: null })).toBe(false);
    expect(aiStepReady({ ...base, provider: '  ' })).toBe(false);
  });

  it('needs the CLI signed in for a plan provider', () => {
    expect(aiStepReady({ ...base, provider: 'claude-code' })).toBe(false);
    expect(aiStepReady({ ...base, provider: 'claude-code', claudeConnected: true })).toBe(true);
    expect(aiStepReady({ ...base, provider: 'codex', codexConnected: true })).toBe(true);
    expect(aiStepReady({ ...base, provider: 'codex', claudeConnected: true })).toBe(false);
  });

  it('needs the local model on disk for builtin-ai, the seeded default', () => {
    expect(aiStepReady({ ...base, provider: 'builtin-ai' })).toBe(false);
    expect(aiStepReady({ ...base, provider: 'builtin-ai', builtinReady: true })).toBe(true);
  });

  it('trusts API providers set up in Settings', () => {
    expect(aiStepReady({ ...base, provider: 'ollama' })).toBe(true);
  });
});

describe('done titles', () => {
  it('names the transcription engine in use', () => {
    expect(transcriptionDoneTitle('parakeet')).toBe('Parakeet is ready');
    expect(transcriptionDoneTitle('localWhisper')).toBe('Whisper is ready');
    expect(transcriptionDoneTitle('deepgram')).toBe('Transcription is ready');
  });

  it('says connected for plans and ready for models', () => {
    expect(aiDoneTitle('claude-code')).toBe('Claude is connected');
    expect(aiDoneTitle('codex')).toBe('ChatGPT is connected');
    expect(aiDoneTitle('builtin-ai')).toBe('Qwen is ready');
    expect(aiDoneTitle('custom-openai')).toBe('AI notes are ready');
  });

  it('never contains a dash', () => {
    for (const title of [aiDoneTitle('codex'), transcriptionDoneTitle('shenava')]) {
      expect(title).not.toMatch(/[-–—]/);
    }
  });
});

describe('home visibility', () => {
  it('cannot be hidden before a transcription model exists', () => {
    expect(homeStepsVisible({ transcriptionDone: false, aiDone: true, dismissed: true })).toBe(true);
    expect(canDismissHomeSteps(false)).toBe(false);
  });

  it('can be dismissed once transcription works', () => {
    expect(canDismissHomeSteps(true)).toBe(true);
    expect(homeStepsVisible({ transcriptionDone: true, aiDone: false, dismissed: false })).toBe(true);
    expect(homeStepsVisible({ transcriptionDone: true, aiDone: false, dismissed: true })).toBe(false);
  });

  it('disappears when both steps are done', () => {
    expect(homeStepsVisible({ transcriptionDone: true, aiDone: true, dismissed: false })).toBe(false);
  });
});

describe('rowSubtitle', () => {
  it('adds the size only once it is known', () => {
    expect(rowSubtitle('English', '670 MB')).toBe('English · 670 MB');
    expect(rowSubtitle('English', undefined)).toBe('English');
    expect(rowSubtitle(undefined, '458 MB')).toBe('458 MB');
  });
});

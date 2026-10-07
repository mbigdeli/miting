'use client';

/** AI notes step: connect Claude or ChatGPT, or download the local Qwen model. */

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { aiStepReady, isChosen } from '@/lib/setupSteps';
import { readSummaryConfig, type SummaryModelConfig } from '@/lib/summaryProvider';
import { AI_COPY } from './options';
import type { StepRow } from './types';
import { useCliOption } from './useCliOption';
import { useQwenOption } from './useQwenOption';

interface CurrentChoice {
  provider: string | null;
  model: string | null;
  loaded: boolean;
}

/** The saved summary provider, kept current through `model-config-updated`. */
function useSummaryChoice(): CurrentChoice {
  const [choice, setChoice] = useState<CurrentChoice>({ provider: null, model: null, loaded: false });
  useEffect(() => {
    readSummaryConfig()
      .then((c) => setChoice({ provider: c?.provider ?? null, model: c?.model ?? null, loaded: true }))
      .catch(() => setChoice((value) => ({ ...value, loaded: true })));
    const pending = listen<SummaryModelConfig>('model-config-updated', ({ payload }) =>
      setChoice({ provider: payload.provider, model: payload.model, loaded: true }),
    );
    return () => {
      void pending.then((unlisten) => unlisten());
    };
  }, []);
  return choice;
}

export function useAiStep() {
  const current = useSummaryChoice();
  const claude = useCliOption('claude', current.provider);
  const chatgpt = useCliOption('chatgpt', current.provider);
  // The local model check belongs to one saved choice; a result for an older
  // choice (or none yet) must not count, or Home flashes before it lands.
  const choice = `${current.provider}:${current.model}`;
  const [builtin, setBuiltin] = useState({ choice: '', ready: false });
  const builtinChecked = builtin.choice === choice;

  const ready = aiStepReady({
    provider: current.provider,
    claudeConnected: claude.connected,
    codexConnected: chatgpt.connected,
    builtinReady: builtinChecked && builtin.ready,
  });
  const qwen = useQwenOption(current, ready);

  useEffect(() => {
    if (current.provider !== 'builtin-ai' || !current.model) {
      setBuiltin({ choice, ready: false });
      return;
    }
    let cancelled = false;
    invoke<boolean>('builtin_ai_is_model_ready', { modelName: current.model, refresh: true })
      .then((value) => !cancelled && setBuiltin({ choice, ready: value }))
      .catch(() => !cancelled && setBuiltin({ choice, ready: false }));
    return () => {
      cancelled = true;
    };
  }, [choice, current.provider, current.model, qwen.state.kind]);

  // Whether the saved provider works must be known before Home decides to show.
  const providerChecked =
    current.provider === 'claude-code' ? claude.checked
    : current.provider === 'codex' ? chatgpt.checked
    : builtinChecked;

  const rows: StepRow[] = [
    {
      key: 'claude',
      ...AI_COPY.claude,
      state: claude.state,
      action: 'connect',
      solid: claude.installed,
      act: () => void claude.connect(),
    },
    {
      key: 'chatgpt',
      ...AI_COPY.chatgpt,
      state: chatgpt.state,
      action: 'connect',
      solid: chatgpt.installed && !claude.installed,
      act: () => void chatgpt.connect(),
    },
    {
      key: 'qwen',
      ...AI_COPY.qwen,
      size: qwen.size,
      state: qwen.state,
      action: 'download',
      orBefore: true,
      act: () => void qwen.act(),
    },
  ];

  return {
    rows,
    ready,
    provider: current.provider,
    loaded: current.loaded && providerChecked,
    chosen: rows.some((row) => isChosen(row.state)),
  };
}

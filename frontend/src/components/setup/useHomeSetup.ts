'use client';

import { useEffect, useState } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { useAiStep } from '@/components/setup-steps/useAiStep';
import { useTranscriptionStep } from '@/components/setup-steps/useTranscriptionStep';
import { homeStepsVisible } from '@/lib/setupSteps';
import { useHomeStepsState } from './useHomeStepsState';

export type StepKey = 'transcription' | 'ai';

/**
 * Everything Home knows about the model setup steps. Read once here so the
 * steps and the Chrome suggestion below them decide from the same facts.
 */
export function useHomeSetup() {
  const { transcriptModelConfig } = useConfig();
  const transcription = useTranscriptionStep();
  const ai = useAiStep();
  const home = useHomeStepsState();
  const [open, setOpen] = useState({ transcription: false, ai: false });

  // A step opened with Change folds up again once the new choice lands.
  const transcriptionChoice = `${transcriptModelConfig?.provider}:${transcriptModelConfig?.model}`;
  useEffect(() => setOpen((value) => ({ ...value, transcription: false })), [transcriptionChoice]);
  useEffect(() => setOpen((value) => ({ ...value, ai: false })), [ai.provider, ai.ready]);

  const loaded = transcription.loaded && ai.loaded && home.loaded;
  const visible =
    loaded &&
    homeStepsVisible({
      transcriptionDone: transcription.ready,
      aiDone: ai.ready,
      dismissed: home.dismissed,
    });

  return {
    loaded,
    visible,
    transcription,
    ai,
    provider: transcriptModelConfig?.provider,
    open,
    reopen: (key: StepKey) => setOpen((value) => ({ ...value, [key]: true })),
    dismiss: home.dismiss,
  };
}

export type HomeSetup = ReturnType<typeof useHomeSetup>;

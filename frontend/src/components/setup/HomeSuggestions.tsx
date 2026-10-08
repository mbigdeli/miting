'use client';

import React, { useState } from 'react';
import { ExtensionGuideDialog } from '@/components/extension-guide/ExtensionGuideDialog';
import { ChromeCard, ChromeReminder, MeetStep } from './ChromeSuggestion';
import { HomeSetupSteps } from './HomeSetupSteps';
import { useChromeSuggestion } from './useChromeSuggestion';
import { useHomeSetup } from './useHomeSetup';

/**
 * Everything Home suggests under the record button: the model setup steps,
 * then the Chrome extension. One thing at a time: Chrome waits until a
 * transcription model works (see lib/chromeSuggestion.ts).
 */
export function HomeSuggestions() {
  const setup = useHomeSetup();
  const chrome = useChromeSuggestion({
    loaded: setup.loaded,
    transcriptionDone: setup.transcription.ready,
    setupVisible: setup.visible,
  });
  const [guideOpen, setGuideOpen] = useState(false);
  const actions = { onAdd: () => setGuideOpen(true), onDismiss: () => void chrome.dismiss() };

  return (
    <>
      {setup.visible && (
        <HomeSetupSteps setup={setup} meet={chrome.kind === 'inline' ? <MeetStep {...actions} /> : undefined} />
      )}
      {chrome.kind === 'card' && <ChromeCard {...actions} />}
      {chrome.kind === 'reminder' && <ChromeReminder {...actions} />}
      {guideOpen && (
        <ExtensionGuideDialog open={guideOpen} onOpenChange={setGuideOpen} connected={chrome.connected} />
      )}
    </>
  );
}

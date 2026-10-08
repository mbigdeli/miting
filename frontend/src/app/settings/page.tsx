'use client';

/**
 * Settings surface (mockups 3a-3f): left tab rail + single content pane.
 * Tab values are kept identical to the legacy page so nothing deep-linking
 * into a tab breaks; each tab component owns its persistence wiring.
 */

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RecordingsTab } from '@/components/settings/RecordingsTab';
import { TranscriptionTab } from '@/components/settings/TranscriptionTab';
import { PreferenceSettings } from '@/components/PreferenceSettings';
import { SummaryModelSettings } from '@/components/SummaryModelSettings';
import { ExtensionTab } from '@/components/settings/ExtensionTab';
import { TranslationTab } from '@/components/settings/TranslationTab';
import { useConfig } from '@/contexts/ConfigContext';
import { SettingsNav } from '@/components/settings/SettingsNav';

const TABS = [
  { value: 'general', label: 'General', desc: 'App-wide preferences, storage, and privacy.' },
  { value: 'recording', label: 'Recordings', desc: 'How audio is captured and saved to disk.' },
  { value: 'Transcriptionmodels', label: 'Transcription', desc: 'Runs fully on-device. Choose an engine and manage models.' },
  { value: 'summaryModels', label: 'Summary', desc: 'Choose the AI that writes your miting notes.' },
  { value: 'translation', label: 'Translation', desc: 'Translate transcripts with the AI you use for notes.' },
  { value: 'extension', label: 'Chrome Extension', desc: 'Optional companion that pulls Google Meet’s own captions.' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

const isTabValue = (value: string | null): value is TabValue =>
  TABS.some((tab) => tab.value === value);

/**
 * `?tab=` lets other screens deep-link to the right pane — the setup checklist
 * used to send "Set up summaries" to whatever tab happened to be first.
 */
const requestedTab = (): TabValue | null => {
  if (typeof window === 'undefined') return null;
  const requested = new URLSearchParams(window.location.search).get('tab');
  return isTabValue(requested) ? requested : null;
};

export default function SettingsPage() {
  const { transcriptModelConfig, setTranscriptModelConfig } = useConfig();
  const [activeTab, setActiveTab] = useState<TabValue>('general');

  // Not a lazy `useState` initializer: this page is prerendered at build time,
  // where `window` does not exist, and React keeps the prerendered initial
  // state through hydration — so the query string was never read and every
  // deep link landed on General.
  useEffect(() => {
    const tab = requestedTab();
    if (tab) setActiveTab(tab);
  }, []);

  // Load saved transcript configuration on mount (kept from the legacy page).
  useEffect(() => {
    const loadTranscriptConfig = async () => {
      try {
        const config = (await invoke('api_get_transcript_config')) as any;
        if (config) {
          setTranscriptModelConfig({
            provider: config.provider || 'localWhisper',
            model: config.model || 'large-v3',
            apiKey: config.apiKey || null,
          });
        }
      } catch (error) {
        console.error('Failed to load transcript config:', error);
      }
    };
    loadTranscriptConfig();
  }, [setTranscriptModelConfig]);

  const meta = TABS.find((tab) => tab.value === activeTab) ?? TABS[0];

  return (
    // h-full + overflow-hidden keeps the tab rail pinned: only the content
    // pane below scrolls, so the nav stays put on long tabs.
    <div className="flex h-full overflow-hidden bg-zinc-50 font-inter text-sm leading-normal text-zinc-950">
      <SettingsNav
        tabs={TABS}
        active={activeTab}
        onSelect={(value) => setActiveTab(value as TabValue)}
      />
      <div className="min-w-0 flex-1 overflow-auto">
        {/* Wide content column: a floor so the panes never squeeze into a
            column of text, and a much higher ceiling so long tabs (models,
            summary) trade vertical scrolling for the width already on screen. */}
        <div className="w-full min-w-[560px] max-w-[1040px] px-10 py-[30px]">
          <h1 className="text-[19px] font-semibold text-zinc-900">{meta.label}</h1>
          <p className="mb-[22px] mt-1 text-[13.5px] text-zinc-500">{meta.desc}</p>

          {activeTab === 'general' && <PreferenceSettings />}
          {activeTab === 'recording' && <RecordingsTab />}
          {activeTab === 'Transcriptionmodels' && (
            <TranscriptionTab
              transcriptModelConfig={transcriptModelConfig}
              setTranscriptModelConfig={setTranscriptModelConfig}
            />
          )}
          {activeTab === 'summaryModels' && <SummaryModelSettings />}
          {activeTab === 'translation' && <TranslationTab />}
          {activeTab === 'extension' && <ExtensionTab />}
        </div>
      </div>
    </div>
  );
}

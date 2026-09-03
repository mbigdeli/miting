'use client';

/**
 * Summary settings tab (mockup 3d): auto-summarize toggle, language pills, and
 * the model-provider configurator. Fetch/save/sync wiring lives unchanged in
 * useSummaryModelConfig; the provider grid stays the shared ModelSettingsModal
 * (also used by meeting details), wrapped in the redesigned card frame.
 */

import { ModelSettingsModal } from '@/components/ModelSettingsModal';
import { SummaryLanguageSettings } from '@/components/SummaryLanguageSettings';
import { useConfig } from '@/contexts/ConfigContext';
import { SectionLabel, SettingRow, RowText, Toggle } from './settings/primitives';
import { useSummaryModelConfig } from './settings/useSummaryModelConfig';

interface SummaryModelSettingsProps {
  refetchTrigger?: number; // Change this to trigger refetch
}

export function SummaryModelSettings({ refetchTrigger }: SummaryModelSettingsProps) {
  const { isAutoSummary, toggleIsAutoSummary } = useConfig();
  const { modelConfig, setModelConfig, handleSaveModelConfig } =
    useSummaryModelConfig(refetchTrigger);

  return (
    <div>
      <SettingRow>
        <RowText
          title="Auto-summarize after each miting"
          desc="Draft notes the moment recording stops"
        />
        <Toggle
          checked={isAutoSummary}
          onChange={toggleIsAutoSummary}
          label="Auto-summarize after each miting"
        />
      </SettingRow>

      <SectionLabel>Summary languages</SectionLabel>
      <div className="rounded-[10px] border border-zinc-200 bg-white p-4">
        <p className="mb-3 text-xs text-zinc-500">
          Notes follow each miting&apos;s own language. Click a language to pin it as the default.
        </p>
        <SummaryLanguageSettings />
      </div>

      <SectionLabel>Model</SectionLabel>
      <div className="rounded-[10px] border border-zinc-200 bg-white p-4">
        <ModelSettingsModal
          modelConfig={modelConfig}
          setModelConfig={setModelConfig}
          onSave={handleSaveModelConfig}
          skipInitialFetch={true}
        />
      </div>
    </div>
  );
}

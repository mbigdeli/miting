'use client';

import { FileText } from 'lucide-react';
import RegenerateSplitButton from './RegenerateSplitButton';
import type { TemplateOption } from './types';

interface SummaryEmptyStateProps {
  hasTranscripts: boolean;
  busy: boolean;
  onGenerate: () => void;
  templates: TemplateOption[];
  selectedTemplate: string;
  onTemplateSelect: (id: string, name: string) => void;
  onOpenModelSettings: () => void;
  customPrompt: string;
  onPromptChange: (value: string) => void;
}

/** "No summary yet" empty state with the brand Generate split button (mockup 2v). */
export default function SummaryEmptyState({
  hasTranscripts,
  busy,
  onGenerate,
  templates,
  selectedTemplate,
  onTemplateSelect,
  onOpenModelSettings,
  customPrompt,
  onPromptChange,
}: SummaryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-10 py-14 text-center">
      <span className="mb-[18px] grid h-14 w-14 place-items-center rounded-full bg-teal-50">
        <FileText size={24} className="text-brand" />
      </span>
      <h2 className="text-base font-semibold text-zinc-900">No summary yet</h2>
      <p className="mt-1.5 max-w-[340px] text-[13.5px] leading-relaxed text-zinc-500">
        {hasTranscripts
          ? 'Generate a summary to pull out the decisions and action items.'
          : 'This miting has no transcript yet, so there is nothing to summarize.'}
      </p>
      {hasTranscripts && (
        <>
          <div className="mt-[22px]">
            <RegenerateSplitButton
              variant="brand"
              label="Generate summary"
              busy={busy}
              onPrimary={onGenerate}
              templates={templates}
              selectedTemplate={selectedTemplate}
              onTemplateSelect={onTemplateSelect}
              onOpenModelSettings={onOpenModelSettings}
            />
          </div>
          <textarea
            value={customPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Optional context for the AI — people involved, meeting goal, agenda…"
            className="mt-6 min-h-[72px] w-full max-w-md resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-brand focus:outline-none"
          />
        </>
      )}
    </div>
  );
}

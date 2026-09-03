'use client';

/**
 * Settings sub-navigation rail (mockups 3a-3f): 186px white column with an
 * uppercase "Settings" label and one pill item per tab. Tab icons come from
 * the Material (ic) set.
 */

import type { IconType } from 'react-icons';
import { captureProduct } from '@/lib/productEvents';
import {
  MdOutlineTune,
  MdOutlineMic,
  MdOutlineSubtitles,
  MdOutlineAutoAwesome,
  MdOutlineExtension,
  MdOutlineScience,
  MdOutlineVideoCall,
} from 'react-icons/md';

export interface SettingsTabMeta {
  value: string;
  label: string;
}

const TAB_ICONS: Record<string, IconType> = {
  general: MdOutlineTune,
  recording: MdOutlineMic,
  Transcriptionmodels: MdOutlineSubtitles,
  summaryModels: MdOutlineAutoAwesome,
  integrations: MdOutlineExtension,
  extension: MdOutlineVideoCall,
  beta: MdOutlineScience,
};

export function SettingsNav({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly SettingsTabMeta[];
  active: string;
  onSelect: (value: string) => void;
}) {
  return (
    <nav className="grid h-full w-[186px] shrink-0 content-start gap-0.5 overflow-y-auto border-r border-zinc-200 bg-white px-3 py-7 text-[13.5px] font-medium">
      <div className="px-3 pb-3 text-[11px] font-bold uppercase tracking-[0.5px] text-zinc-400">
        Settings
      </div>
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.value];
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              onSelect(tab.value);
              captureProduct('settings_section_viewed', { section: tab.value });
              // Give settings content the full width: the main nav rail
              // auto-collapses (and restores itself when the user leaves).
              window.dispatchEvent(new CustomEvent('miting:settings-section-selected'));
            }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left ${
              active === tab.value
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
            }`}
          >
            {Icon && <Icon size={16} className="shrink-0" />}
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

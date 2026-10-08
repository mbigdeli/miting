'use client';

/**
 * Transcription engine picker: three compact tiles instead of stacked radio
 * rows, each carrying the engine's own mark so the list scans at a glance.
 */

import type { IconType } from 'react-icons';
import { SiNvidia } from 'react-icons/si';
import { RiOpenaiFill } from 'react-icons/ri';
import { Check } from 'lucide-react';

export type LocalProvider = 'parakeet' | 'localWhisper' | 'shenava';

/** Persian wordmark stands in for Shenava, which ships no logo. */
const ShenavaMark: IconType = () => (
  <span className="font-vazir text-[19px] font-bold leading-none text-brand">ش</span>
);

interface Engine {
  id: LocalProvider;
  name: string;
  desc: string;
  Icon: IconType;
  iconClass: string;
}

export const ENGINES: Engine[] = [
  {
    id: 'parakeet',
    name: 'Parakeet',
    desc: 'Fastest, best for real time',
    Icon: SiNvidia,
    iconClass: 'text-[#76B900]',
  },
  {
    id: 'localWhisper',
    name: 'Whisper',
    desc: 'Widest language coverage',
    Icon: RiOpenaiFill,
    iconClass: 'text-zinc-900',
  },
  {
    id: 'shenava',
    name: 'Shenava',
    desc: 'Tuned for Persian',
    Icon: ShenavaMark,
    iconClass: '',
  },
];

export function EnginePicker({
  value,
  onChange,
}: {
  value: LocalProvider;
  onChange: (id: LocalProvider) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ENGINES.map(({ id, name, desc, Icon, iconClass }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`relative rounded-[10px] bg-white p-3.5 text-left transition-colors ${
              active
                ? 'border-[1.5px] border-brand'
                : 'border border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <span className="flex h-6 items-center">
              <Icon size={20} className={iconClass} aria-hidden="true" />
            </span>
            <span className="mt-2 block text-[13px] font-semibold text-zinc-900">{name}</span>
            <span className="mt-px block text-[11.5px] leading-snug text-zinc-500">{desc}</span>
            {active && (
              <Check
                size={14}
                strokeWidth={3}
                className="absolute right-3 top-3 text-brand"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

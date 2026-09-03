'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, Loader2, RotateCcw, Settings2, Sparkles } from 'lucide-react';
import type { TemplateOption } from './types';

interface RegenerateSplitButtonProps {
  variant: 'brand' | 'outline';
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPrimary: () => void;
  templates: TemplateOption[];
  selectedTemplate: string;
  onTemplateSelect: (id: string, name: string) => void;
  onOpenModelSettings?: () => void;
}

/** Generate/Regenerate split button with the summary-template menu (mockups 2h/2v). */
export default function RegenerateSplitButton({
  variant,
  label,
  busy = false,
  disabled = false,
  onPrimary,
  templates,
  selectedTemplate,
  onTemplateSelect,
  onOpenModelSettings,
}: RegenerateSplitButtonProps) {
  const brand = variant === 'brand';
  const wrap = brand
    ? 'inline-flex overflow-hidden rounded-lg bg-brand text-white'
    : 'inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900';
  const primaryCls = brand
    ? 'inline-flex h-9 items-center gap-1.5 px-3.5 text-[13px] font-medium transition-colors hover:bg-teal-700 disabled:opacity-60'
    : 'inline-flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-medium transition-colors hover:bg-zinc-50 disabled:opacity-60';
  const chevronCls = brand
    ? 'grid h-9 w-[34px] place-items-center border-l border-white/25 transition-colors hover:bg-teal-700'
    : 'grid h-8 w-[30px] place-items-center border-l border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50';

  return (
    <div className={wrap}>
      <button type="button" className={primaryCls} onClick={onPrimary} disabled={disabled || busy}>
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : brand ? (
          <Sparkles size={14} className="fill-white text-white" />
        ) : (
          <RotateCcw size={13} />
        )}
        {label}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" title="Choose template" className={chevronCls} disabled={busy}>
            <ChevronDown size={13} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-[10.5px] font-semibold uppercase tracking-wide text-zinc-400">
            Summary template
          </DropdownMenuLabel>
          {templates.map((t) => (
            <DropdownMenuItem
              key={t.id}
              title={t.description}
              onClick={() => onTemplateSelect(t.id, t.name)}
              className="flex items-center gap-2"
            >
              <span className="w-3.5">
                {selectedTemplate === t.id && <Check size={14} className="text-brand" />}
              </span>
              {t.name}
            </DropdownMenuItem>
          ))}
          {onOpenModelSettings && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onOpenModelSettings} className="text-teal-700">
                <Settings2 size={14} className="mr-2" />
                AI model settings
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

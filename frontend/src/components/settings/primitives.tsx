'use client';

/**
 * Shared building blocks for the redesigned Settings tabs
 * (Miting-Redesign mockups, miting-settings.dc.html blocks 3a-3f).
 */

import { ReactNode } from 'react';

/** Uppercase zinc-400 section label above a group of rows. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 mt-[22px] text-[11px] font-bold uppercase tracking-[0.5px] text-zinc-400">
      {children}
    </div>
  );
}

/** White bordered row card (14px/16px padding, 10px radius). */
export function SettingRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center gap-3.5 rounded-[10px] border border-zinc-200 bg-white px-4 py-3.5 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

/** Title + optional description block filling the left side of a SettingRow. */
export function RowText({
  title,
  desc,
  mono = false,
}: {
  title: ReactNode;
  desc?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[13.5px] font-semibold text-zinc-900">{title}</div>
      {desc !== undefined && (
        <div className={`mt-px break-all text-xs text-zinc-500 ${mono ? 'font-mono' : ''}`}>
          {desc}
        </div>
      )}
    </div>
  );
}

/** 40x22 pill toggle (brand teal on, zinc-200 off). */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-brand' : 'bg-zinc-200'
      }`}
    >
      <span
        className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] ${
          checked ? 'left-[20px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

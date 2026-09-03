'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { SetupItem, SetupItemId } from '@/lib/setupChecklist';

interface SetupChecklistCardProps {
  items: SetupItem[];
  onAction: (id: SetupItemId) => void;
  onDismiss: () => void;
}

/**
 * Advisory notice, never a blocker: recording works without any of these.
 * Dismissible, and it comes back if a *different* piece of setup goes missing.
 */
export function SetupChecklistCard({ items, onAction, onDismiss }: SetupChecklistCardProps) {
  if (items.length === 0) return null;

  return (
    <div className="relative rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss setup notice"
        className="absolute right-2 top-2 rounded p-1 text-zinc-400 hover:text-zinc-700"
      >
        <X size={14} />
      </button>

      <p className="pr-6 text-[13px] font-semibold text-zinc-900">Setup is incomplete</p>
      <p className="mt-0.5 text-[12px] text-zinc-500">
        You can record meetings now and complete these whenever you like.
      </p>

      <ul className="mt-2.5 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-zinc-900">{item.title}</p>
              <p className="text-[12px] leading-snug text-zinc-500">{item.description}</p>
            </div>
            <button
              type="button"
              onClick={() => onAction(item.id)}
              className="shrink-0 rounded-md border border-zinc-300 px-2.5 py-1 text-[12px] font-medium text-zinc-800 hover:bg-zinc-50"
            >
              {item.actionLabel}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

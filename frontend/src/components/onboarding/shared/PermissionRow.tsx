import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PermissionRowProps } from '@/types/onboarding';

interface Props extends PermissionRowProps {
  /** Subtitle shown while the permission request is pending (e.g. "Verifying audio…"). */
  pendingDescription?: string;
}

/**
 * Permission card: icon circle + title/subtitle, with a right-side
 * Enabled badge, "Checking…" spinner, or Enable / Open Settings button.
 */
export function PermissionRow({
  icon,
  title,
  description,
  status,
  isPending = false,
  onAction,
  pendingDescription,
}: Props) {
  const isAuthorized = status === 'authorized';
  const isDenied = status === 'denied';

  const subtitle = isAuthorized
    ? description
    : isPending
    ? pendingDescription ?? description
    : isDenied
    ? 'Denied · enable in System Settings'
    : description;

  return (
    <div className="flex items-center gap-[13px] rounded-xl border border-zinc-200 bg-white px-[18px] py-4">
      <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-600">
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-zinc-900">{title}</div>
        <div
          className={cn(
            'text-[12.5px]',
            isDenied && !isPending && !isAuthorized ? 'text-red-600' : 'text-zinc-500'
          )}
        >
          {subtitle}
        </div>
      </div>

      {isAuthorized ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-green-600">
          <Check className="h-[15px] w-[15px]" strokeWidth={2.5} />
          Enabled
        </span>
      ) : isPending ? (
        <span className="inline-flex shrink-0 items-center gap-2 text-[12.5px] text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
          Checking…
        </span>
      ) : (
        <button
          type="button"
          onClick={onAction}
          className="h-8 shrink-0 rounded-lg border border-zinc-200 bg-white px-3.5 text-[12.5px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          {isDenied ? 'Open Settings' : 'Enable'}
        </button>
      )}
    </div>
  );
}

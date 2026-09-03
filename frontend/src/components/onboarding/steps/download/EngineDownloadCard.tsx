import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EngineDownloadStatus = 'waiting' | 'downloading' | 'completed' | 'error';

export interface EngineDownloadState {
  status: EngineDownloadStatus;
  progress: number;
  downloadedMb: number;
  totalMb: number;
  error?: string;
}

interface EngineDownloadCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  state: EngineDownloadState;
  unit?: string;
  onRetry?: () => void;
  /** Starts the download. Nothing downloads until the user asks for it. */
  onDownload?: () => void;
  downloadLabel?: string;
}

/**
 * White engine card used on the download step: icon circle, title,
 * status subtitle, and a right-side Download button / spinner / green check /
 * Retry button. A slim progress bar with MB counts appears while downloading.
 */
export function EngineDownloadCard({
  title,
  subtitle,
  icon,
  state,
  unit = 'MB',
  onRetry,
  onDownload,
  downloadLabel = 'Download',
}: EngineDownloadCardProps) {
  const { status, progress, downloadedMb, totalMb, error } = state;
  const showBar = status === 'downloading';

  // Mirror the mockup: sizes ≥1 GB read as GB ("0.45 GB / 2.5 GB"), smaller ones as MB.
  const formatSize = (valueMb: number) => {
    if (totalMb >= 1000) {
      const gb = valueMb / 1000;
      return `${gb.toFixed(gb < 1 ? 2 : 1)} GB`;
    }
    return `${valueMb.toFixed(1)} ${unit}`;
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-[18px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-zinc-100">
            {icon}
          </span>
          <div className="min-w-0">
            <strong className="text-[13.5px] font-semibold text-zinc-900">{title}</strong>
            <div
              className={cn(
                'truncate text-[12.5px]',
                status === 'error' ? 'text-red-600' : 'text-zinc-500'
              )}
              title={status === 'error' ? error : undefined}
            >
              {status === 'error' ? 'Download failed' : status === 'completed' ? 'Ready' : subtitle}
            </div>
          </div>
        </div>

        {status === 'waiting' &&
          (onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="h-[30px] shrink-0 rounded-[7px] bg-zinc-900 px-[13px] text-xs font-medium text-white transition-colors hover:bg-zinc-800"
            >
              {downloadLabel}
            </button>
          ) : (
            <span
              aria-label="Preparing"
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900"
            />
          ))}
        {status === 'downloading' && (
          <span
            aria-label="Downloading"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900"
          />
        )}
        {status === 'completed' && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green-100">
            <Check className="h-[13px] w-[13px] text-green-600" strokeWidth={3} />
          </span>
        )}
        {status === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="h-[30px] shrink-0 rounded-[7px] border border-zinc-200 bg-white px-[13px] text-xs font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            Retry
          </button>
        )}
      </div>

      {showBar && (
        <>
          <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="mt-[7px] flex justify-between text-[12.5px]">
            <span className="tabular-nums text-zinc-500">
              {formatSize(downloadedMb)} / {formatSize(totalMb)}
            </span>
            <span className="font-semibold tabular-nums text-zinc-900">
              {Math.round(progress)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}

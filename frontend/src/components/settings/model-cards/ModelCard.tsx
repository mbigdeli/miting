'use client';

/** One model row in the redesigned Transcription settings (brand accents). */

import { Check, Download, RotateCcw, Trash2, X } from 'lucide-react';
import type { EngineModel } from './types';

const ACTION =
  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-[13px] py-[7px] text-[12.5px] font-semibold transition-colors';

/** Downloaded-but-inactive → outline brand; active → solid brand. */
const USE = 'border border-brand text-brand hover:bg-brand/5';
const SELECTED = 'bg-brand text-white';
/** Not on disk yet — tinted so the primary action reads at a glance. */
const GET = 'border border-brand/25 bg-brand/[0.06] text-brand hover:bg-brand/10';

export function ModelCard({
  model,
  selected,
  progress,
  onSelect,
  onDownload,
  onCancel,
  onRemoveCorrupted,
}: {
  model: EngineModel;
  selected: boolean;
  /** Live download percentage — overrides the listed status while present. */
  progress?: number;
  onSelect: () => void;
  onDownload: () => void;
  onCancel?: () => void;
  onRemoveCorrupted?: () => void;
}) {
  const downloading = progress !== undefined || model.status.kind === 'downloading';
  const percent =
    progress ?? (model.status.kind === 'downloading' ? model.status.progress : 0);
  const failed = model.status.kind === 'error';

  return (
    <div
      className={`rounded-[10px] border bg-white p-4 ${
        selected ? 'border-[1.5px] border-brand' : 'border-zinc-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-zinc-900">{model.displayName}</p>
          {model.description && <p className="mt-px text-xs text-zinc-500">{model.description}</p>}
          <p className="mt-1 text-[11.5px] text-zinc-400">{model.sizeMb} MB</p>
        </div>

        {downloading ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[12.5px] tabular-nums text-zinc-500">{Math.round(percent)}%</span>
            {onCancel && (
              <button type="button" onClick={onCancel} className={`${ACTION} border border-zinc-200 text-zinc-600 hover:bg-zinc-50`}>
                <X size={14} strokeWidth={2.5} aria-hidden="true" />
                Cancel
              </button>
            )}
          </div>
        ) : model.status.kind === 'available' ? (
          <button
            type="button"
            onClick={onSelect}
            className={`${ACTION} ${selected ? SELECTED : USE}`}
          >
            <Check size={14} strokeWidth={3} aria-hidden="true" />
            {selected ? 'Selected' : 'Use'}
          </button>
        ) : model.status.kind === 'corrupted' ? (
          <button type="button" onClick={onRemoveCorrupted} className={`${ACTION} border border-amber-300 text-amber-700 hover:bg-amber-50`}>
            <Trash2 size={14} aria-hidden="true" />
            Delete &amp; redownload
          </button>
        ) : (
          <button type="button" onClick={onDownload} className={`${ACTION} ${GET}`}>
            {failed ? <RotateCcw size={14} aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
            {failed ? 'Retry' : 'Download'}
          </button>
        )}
      </div>

      {model.status.kind === 'corrupted' && (
        <p className="mt-2 text-xs text-amber-700">
          The downloaded file is incomplete or damaged — delete it and download again.
        </p>
      )}
      {model.status.kind === 'error' && (
        <p className="mt-2 text-xs text-red-600">{model.status.message}</p>
      )}
      {downloading && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

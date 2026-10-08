import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RING, Tag } from './Callout';

export function FolderIcon({ size = 13, color = '#FFB900' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" className="shrink-0">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

const WIN_BTN = 'inline-flex h-[26px] items-center rounded-[3px] border px-3.5 text-[11.5px]';

/**
 * The Windows folder window Chrome opens for Load unpacked. Its address bar
 * takes a pasted path, which is the whole trick of step 3.
 */
export function WinFolderPicker({ path, typed, callouts }: {
  path: string;
  /** Characters typed so far during the walkthrough; null shows all. */
  typed: number | null;
  callouts: boolean;
}) {
  const address =
    typed === null ? (
      <span className="truncate bg-[#CCE4F7] text-[11.5px]">{path}</span>
    ) : typed === 0 ? (
      <span className="text-[11.5px] text-[#9E9E9E]">This PC</span>
    ) : (
      <span className="truncate text-[11.5px]">
        {path.slice(0, typed)}
        <span className="ml-px inline-block h-[13px] w-px animate-pulse bg-[#1F1F1F] align-[-2px]" />
      </span>
    );

  return (
    <>
      <div className="absolute inset-0 bg-[#1F1F1F]/25" />
      <div className="absolute left-1/2 top-[92px] w-[520px] -translate-x-1/2 rounded-lg border border-[#BDBDBD] bg-white text-xs text-[#1F1F1F] shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <div className="flex h-8 items-center justify-between border-b border-[#E5E5E5] px-3">
          <span>Select the extension directory.</span>
          <X className="h-3 w-3" />
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <ArrowLeft className="h-3.5 w-3.5 text-[#9E9E9E]" />
          <ArrowRight className="h-3.5 w-3.5 text-[#9E9E9E]" />
          <ArrowUp className="h-3.5 w-3.5" />
          <span
            data-demo="addr"
            className={cn('relative flex h-[26px] min-w-0 flex-1 items-center gap-1.5 border border-[#0078D4] px-2', callouts && RING)}
          >
            <FolderIcon />
            {address}
            {callouts && <Tag>Paste the path here, then Enter</Tag>}
          </span>
          <span className="flex h-[26px] w-[120px] items-center justify-between border border-[#D6D6D6] px-2 text-[11px] text-[#9E9E9E]">
            Search
            <Search className="h-[11px] w-[11px]" />
          </span>
        </div>
        <div className="flex gap-4 px-3 pb-2 pt-1 text-[11.5px]">
          <span>Organize</span>
          <span>New folder</span>
        </div>
        <div className="flex border-t border-[#EEEEEE]">
          <div className="w-[120px] shrink-0 border-r border-[#EEEEEE] px-2.5 py-2 text-[11.5px] leading-6">
            <div>Desktop</div>
            <div>Downloads</div>
            <div>Documents</div>
            <div>Pictures</div>
          </div>
          <div className="min-w-0 flex-1 px-3 py-1.5 text-[11.5px]">
            <div className="flex gap-3 pb-1.5 pt-0.5 text-[11px] text-[#616161]">
              <span className="w-[140px]">Name</span>
              <span className="w-[120px]">Date modified</span>
              <span>Type</span>
            </div>
            {['assets', 'chunks'].map((name) => (
              <div key={name} className="flex items-center gap-3 py-[3px]">
                <span className="inline-flex w-[140px] items-center gap-1.5">
                  <FolderIcon />
                  {name}
                </span>
                <span className="w-[120px] text-[#616161]">Today</span>
                <span className="text-[#616161]">File folder</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-[#EEEEEE] bg-[#F3F3F3] px-3 py-2.5 text-[11.5px]">
          <span>Folder:</span>
          <span className="flex h-6 flex-1 items-center border border-[#D6D6D6] bg-white px-2">extension</span>
          <span data-demo="select" className={cn(WIN_BTN, 'border-[#0067C0] bg-[#0067C0] font-medium text-white', callouts && RING)}>
            Select Folder
          </span>
          <span className={cn(WIN_BTN, 'border-[#D6D6D6] bg-white')}>Cancel</span>
        </div>
      </div>
    </>
  );
}

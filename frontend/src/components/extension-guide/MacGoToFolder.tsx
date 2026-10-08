import React from 'react';
import type { MacStage } from '@/lib/extensionDemo';
import { cn } from '@/lib/utils';
import { KeyOverlay, RING, Tag } from './Callout';
import { FolderIcon } from './WinFolderPicker';

/**
 * macOS Go to Folder (⌘⇧G) over the open panel, plus the keys being pressed
 * while the walkthrough plays. `stage` null is the still picture.
 */
export function MacGoToFolder({ path, stage, callouts }: {
  path: string;
  stage: MacStage | null;
  callouts: boolean;
}) {
  const still = stage === null;
  const open = still || stage === 'goto' || stage === 'paste' || stage === 'pasted' || stage === 'return';
  const empty = stage === 'goto' || stage === 'paste';
  const suggest = still || stage === 'pasted' || stage === 'return';

  return (
    <>
      {open && (
        <div className="absolute left-1/2 top-[52px] z-[3] w-[400px] -translate-x-1/2 rounded-[10px] border border-black/15 bg-white p-2 shadow-[0_12px_34px_rgba(0,0,0,0.28)]">
          <div
            data-demo="goto"
            className={cn(
              'relative flex h-[30px] items-center gap-[7px] rounded-[7px] border-2 border-[#8CBDF9] px-2 text-[12.5px]',
              still && callouts && RING,
            )}
          >
            <FolderIcon size={14} color="#3B9BF5" />
            {!empty && <span className="truncate">{path}</span>}
            {!still && <span className="inline-block h-[13px] w-px animate-pulse bg-[#1D1D1F]" />}
            {still && callouts && (
              <Tag up>Press ⌘ ⇧ G, paste the path, press Return</Tag>
            )}
          </div>
          {suggest && (
            <div className="mt-1.5 flex items-center gap-[7px] rounded-md bg-[#0A7AFF] px-2 py-[5px] text-xs text-white">
              <FolderIcon size={14} color="#FFFFFF" />
              extension
            </div>
          )}
        </div>
      )}
      {stage === 'keys' && <KeyOverlay keys={['⌘', '⇧', 'G']} label="Go to Folder" />}
      {stage === 'paste' && <KeyOverlay keys={['⌘', 'V']} label="Paste" />}
      {stage === 'return' && <KeyOverlay keys={['return ↵']} />}
    </>
  );
}

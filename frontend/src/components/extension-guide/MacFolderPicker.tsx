import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsUpDown, File, Search } from 'lucide-react';
import type { MacStage } from '@/lib/extensionDemo';
import { cn } from '@/lib/utils';
import { RING } from './Callout';
import { MacGoToFolder } from './MacGoToFolder';
import { FolderIcon } from './WinFolderPicker';

const DOWNLOADS: [string, string, boolean][] = [
  ['Miting.dmg', 'Yesterday', false],
  ['Invoice October.pdf', 'Oct 2', false],
  ['Screenshot.png', 'Oct 1', false],
  ['Projects', 'Sep 28', true],
];
const EXTENSION: [string, string, boolean][] = [
  ['assets', 'Today', true],
  ['chunks', 'Today', true],
  ['background.js', 'Today', false],
  ['manifest.json', 'Today', false],
  ['popup.html', 'Today', false],
];

const MAC_BTN = 'relative inline-flex h-[22px] items-center rounded-md border px-3 text-xs shadow-[0_1px_1px_rgba(0,0,0,0.05)]';

/**
 * The macOS open panel Chrome shows for Load unpacked. There is no address
 * bar to paste into, so the picture always shows Go to Folder on top.
 */
export function MacFolderPicker({ path, stage, callouts }: {
  path: string;
  stage: MacStage | null;
  callouts: boolean;
}) {
  const still = stage === null;
  const inside = still || stage === 'return' || stage === 'ext';
  const rows = stage === 'return' || stage === 'ext' ? EXTENSION : DOWNLOADS;

  return (
    <>
      <div className="absolute inset-0 bg-[#1F1F1F]/25" />
      <div className="absolute left-1/2 top-20 w-[560px] -translate-x-1/2 overflow-hidden rounded-[10px] border border-black/20 bg-white text-xs text-[#1D1D1F] shadow-[0_18px_50px_rgba(0,0,0,0.3)]">
        <div className="flex h-10 items-center gap-2.5 border-b border-[#E3E3E3] bg-[#F6F6F6] px-3">
          <ChevronLeft className="h-3.5 w-3.5 text-[#8E8E93]" />
          <ChevronRight className="h-3.5 w-3.5 text-[#C7C7CC]" />
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#DCDCDC] bg-white px-2 py-[3px] font-medium">
            <FolderIcon size={14} color="#3B9BF5" />
            {stage === 'return' || stage === 'ext' ? 'extension' : 'Downloads'}
            <ChevronsUpDown className="h-2.5 w-2.5 text-[#8E8E93]" />
          </span>
          <span className="ml-auto flex h-[22px] w-[130px] items-center gap-1.5 rounded-md bg-[#E9E9EB] px-[7px] text-[11.5px] text-[#8E8E93]">
            <Search className="h-[11px] w-[11px]" />
            Search
          </span>
        </div>
        <div className="flex h-[170px]">
          <div className="w-[140px] shrink-0 border-r border-[#E3E3E3] bg-[#F2F2F4] p-2">
            <div className="px-1.5 pb-1 pt-0.5 text-[10.5px] font-semibold text-[#8E8E93]">Favorites</div>
            {['Recents', 'Applications', 'Desktop', 'Documents', 'Downloads'].map((name) => (
              <div key={name} className={cn('rounded-[5px] px-1.5 py-[3px]', name === 'Downloads' && !inside && 'bg-[#DCDCE0]')}>
                {name}
              </div>
            ))}
          </div>
          <div data-demo="list" className="min-w-0 flex-1 py-1.5">
            {rows.map(([name, date, folder]) => (
              <div key={name} className="flex items-center gap-2 px-3.5 py-[3px] even:bg-[#F5F5F7]">
                {folder ? <FolderIcon size={14} color="#3B9BF5" /> : <File className="h-[13px] w-[13px] text-[#8E8E93]" />}
                {name}
                <span className="ml-auto text-[11px] text-[#8E8E93]">{date}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-[#E3E3E3] bg-[#F6F6F6] px-3 py-2.5">
          <span className={cn(MAC_BTN, 'border-[#D1D1D6] bg-white')}>New Folder</span>
          <span className="flex-1" />
          <span className={cn(MAC_BTN, 'border-[#D1D1D6] bg-white')}>Cancel</span>
          <span
            data-demo="select"
            className={cn(MAC_BTN, 'border-[#0A7AFF] bg-[#0A7AFF] font-medium text-white', !inside && 'opacity-45', still && callouts && RING)}
          >
            Select
          </span>
        </div>
        <MacGoToFolder path={path} stage={stage} callouts={callouts} />
      </div>
    </>
  );
}

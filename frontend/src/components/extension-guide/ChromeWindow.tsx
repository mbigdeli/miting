import React from 'react';
import { ArrowLeft, ArrowRight, EllipsisVertical, Plus, Puzzle, RotateCw, X } from 'lucide-react';
import type { DemoView } from '@/lib/extensionDemo';
import { ExtensionsPage } from './ExtensionsPage';
import { MacFolderPicker } from './MacFolderPicker';
import { WinFolderPicker } from './WinFolderPicker';

/**
 * A light theme Chrome window on chrome://extensions, drawn in HTML so it can
 * point at the exact switch or button each step needs. Screenshots could not
 * do that, and they could not show the Mac folder window either.
 */
export function ChromeWindow({ view, callouts, isMac, path }: {
  view: DemoView;
  /** Rings and labels on the control to press (off while the demo plays). */
  callouts: boolean;
  isMac: boolean;
  path: string;
}) {
  return (
    <div className="relative h-[400px] min-w-[580px] flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white font-inter text-[#1F1F1F] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex h-9 items-end bg-[#DEE1E6] px-2.5">
        {isMac && (
          <span className="mb-[11px] ml-1 mr-3.5 flex gap-[7px]">
            <i className="h-[11px] w-[11px] rounded-full bg-[#FF5F57]" />
            <i className="h-[11px] w-[11px] rounded-full bg-[#FEBC2E]" />
            <i className="h-[11px] w-[11px] rounded-full bg-[#28C840]" />
          </span>
        )}
        <div className="flex h-[30px] items-center gap-2 rounded-t-lg bg-white px-3 text-xs">
          <Puzzle className="h-3.5 w-3.5 text-[#5F6368]" />
          Extensions
          <X className="ml-1.5 h-3 w-3 text-[#5F6368]" />
        </div>
        <Plus className="mb-[9px] ml-2 h-3.5 w-3.5 text-[#5F6368]" />
      </div>
      <div className="flex h-10 items-center gap-2.5 border-b border-[#E5E7EB] px-3">
        <ArrowLeft className="h-4 w-4 text-[#5F6368]" />
        <ArrowRight className="h-4 w-4 text-[#C4C7C5]" />
        <RotateCw className="h-4 w-4 text-[#5F6368]" />
        <span className="flex h-7 flex-1 items-center gap-2 rounded-full bg-[#F1F3F4] px-3 text-[12.5px]">
          <span className="inline-flex items-center gap-[5px] rounded-full bg-white py-0.5 pl-1.5 pr-2 text-[11px] text-[#444746]">
            <span className="grid h-[11px] w-[11px] place-items-center rounded-full bg-[#4285F4]">
              <span className="h-1 w-1 rounded-full bg-white" />
            </span>
            Chrome
          </span>
          chrome://extensions
        </span>
        <Puzzle className="h-4 w-4 text-[#5F6368]" />
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#C2E7FF] text-[10px] font-semibold text-[#004A77]">
          M
        </span>
        <EllipsisVertical className="h-4 w-4 text-[#5F6368]" />
      </div>

      <ExtensionsPage view={view} callouts={callouts} />

      {view.picker &&
        (isMac ? (
          <MacFolderPicker path={path} stage={view.macStage} callouts={callouts} />
        ) : (
          <WinFolderPicker path={path} typed={view.typed} callouts={callouts} />
        ))}
    </div>
  );
}

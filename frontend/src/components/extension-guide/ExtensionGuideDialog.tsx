'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ExtensionGuide } from './ExtensionGuide';

/** The guide over Home, opened from "Add to Chrome". */
export function ExtensionGuideDialog({ open, onOpenChange, connected }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connected: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1040px] gap-0 rounded-2xl bg-white px-10 py-6 font-inter sm:rounded-2xl">
        <DialogTitle className="text-xl font-semibold leading-7 tracking-[-0.3px] text-zinc-950">
          Add Miting to Google Meet
        </DialogTitle>
        <DialogDescription className="mt-1.5 text-[13.5px] text-zinc-500">
          Miting reads the captions Meet already shows, so your notes say who said what.
        </DialogDescription>
        <div className="mt-5">
          <ExtensionGuide connected={connected} />
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={!connected}
            className="h-10 min-w-[160px] rounded-lg bg-zinc-900 px-[18px] text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {connected ? 'Done' : 'Waiting for Chrome'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

/**
 * About entry for the redesigned nav: an info row at the bottom of the rail
 * that opens the existing About panel (version, update check, contact,
 * analytics consent) in a dialog — same content the legacy sidebar offered.
 */

import { useState } from 'react';
import { MdOutlineInfo } from 'react-icons/md';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { About } from '@/components/About';

export default function AboutDialog({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={collapsed ? 'About Miting' : undefined}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
      >
        <MdOutlineInfo size={16} className="shrink-0" />
        {!collapsed && 'About'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>About Miting</DialogTitle>
          </DialogHeader>
          <About />
        </DialogContent>
      </Dialog>
    </>
  );
}

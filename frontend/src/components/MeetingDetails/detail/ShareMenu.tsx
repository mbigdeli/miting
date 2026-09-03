'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Copy, Download, FileText, FolderOpen, Lock, Upload } from 'lucide-react';
import Analytics from '@/lib/analytics';

interface ShareMenuProps {
  onCopySummary: () => Promise<void>;
  onCopyTranscript: () => void | Promise<void>;
  onOpenMeetingFolder: () => Promise<void>;
  /** "Share" (header, default) or "Export" (Details tab). */
  label?: 'Share' | 'Export';
}

/** Header Share menu (mockup 2v share sheet, limited to shipped local actions). */
export default function ShareMenu({
  onCopySummary,
  onCopyTranscript,
  onOpenMeetingFolder,
  label = 'Share',
}: ShareMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          {label === 'Share' ? <Upload size={14} /> : <Download size={14} />}
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem
          onClick={() => {
            Analytics.trackButtonClick('copy_summary', 'meeting_details');
            void onCopySummary();
          }}
        >
          <Copy size={15} className="mr-2 text-zinc-600" />
          Copy summary
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            Analytics.trackButtonClick('copy_transcript', 'meeting_details');
            void onCopyTranscript();
          }}
        >
          <FileText size={15} className="mr-2 text-zinc-600" />
          Copy transcript
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            Analytics.trackButtonClick('open_recording_folder', 'meeting_details');
            void onOpenMeetingFolder();
          }}
        >
          <FolderOpen size={15} className="mr-2 text-zinc-600" />
          Open recording folder
        </DropdownMenuItem>
        <div className="flex items-center gap-1.5 border-t border-zinc-100 px-2 pb-1 pt-2 text-[11.5px] text-zinc-400">
          <Lock size={12} />
          Nothing leaves your device unless you send it.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

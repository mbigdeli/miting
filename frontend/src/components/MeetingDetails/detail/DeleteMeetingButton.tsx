'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CurrentMeeting, useSidebar } from '@/components/Sidebar/SidebarProvider';
import Analytics from '@/lib/analytics';

/** Delete-meeting action with confirmation (mockup 2w). Mirrors the sidebar delete flow. */
export default function DeleteMeetingButton({ meetingId }: { meetingId: string }) {
  const { meetings, setMeetings, setCurrentMeeting } = useSidebar();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      await invoke('api_delete_meeting', { meetingId });
      setMeetings(meetings.filter((m: CurrentMeeting) => m.id !== meetingId));
      Analytics.trackMeetingDeleted(meetingId);
      toast.success('Miting deleted successfully', {
        description: 'All associated data has been removed',
      });
      setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
      router.push('/meetings');
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      toast.error('Failed to delete miting', {
        description: error instanceof Error ? error.message : String(error),
      });
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        <Trash2 size={14} />
        Delete meeting
      </button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-[15px] font-semibold text-zinc-900">
            Delete this meeting?
          </DialogTitle>
          <p className="text-[13px] leading-relaxed text-zinc-500">
            The recording, transcript and summary will be permanently removed from this device.
            This cannot be undone.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDelete()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { TranscriptRecovery } from '@/components/TranscriptRecovery';
import { useTranscriptRecovery } from '@/hooks/useTranscriptRecovery';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useRecoveryStartupCheck } from './useRecoveryStartupCheck';

interface HomeRecoveryProps {
  /** True while recording or stop-processing — startup recovery checks are skipped. */
  pauseChecks: boolean;
}

/**
 * Startup transcript-recovery flow for the Record screen (extracted unchanged
 * from page.tsx): IndexedDB cleanup, recoverable-meeting detection, and the
 * recovery dialog with toast + navigation handling.
 */
export function HomeRecovery({ pauseChecks }: HomeRecoveryProps) {
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const { refetchMeetings } = useSidebar();
  const router = useRouter();
  const {
    recoverableMeetings,
    checkForRecoverableTranscripts,
    recoverMeeting,
    loadMeetingTranscripts,
    deleteRecoverableMeeting,
  } = useTranscriptRecovery();

  useRecoveryStartupCheck(pauseChecks, checkForRecoverableTranscripts);

  // Watch for recoverable meetings changes and show dialog once per session
  useEffect(() => {
    if (recoverableMeetings.length > 0) {
      const shownThisSession = sessionStorage.getItem('recovery_dialog_shown');
      if (!shownThisSession) {
        setShowRecoveryDialog(true);
        sessionStorage.setItem('recovery_dialog_shown', 'true');
      }
    }
  }, [recoverableMeetings]);

  // Handle recovery with toast notifications and navigation
  const handleRecovery = async (meetingId: string) => {
    try {
      const result = await recoverMeeting(meetingId);

      if (result.success) {
        toast.success('Miting recovered successfully!', {
          description:
            result.audioRecoveryStatus?.status === 'success'
              ? 'Transcripts and audio recovered'
              : 'Transcripts recovered (no audio available)',
          action: result.meetingId
            ? {
                label: 'View Miting',
                onClick: () => {
                  router.push(`/meeting-details?id=${result.meetingId}`);
                },
              }
            : undefined,
          duration: 10000,
        });

        // Refresh sidebar to show the newly recovered meeting
        await refetchMeetings();

        // If no more recoverable meetings, clear session flag so dialog can show again
        if (recoverableMeetings.length === 0) {
          sessionStorage.removeItem('recovery_dialog_shown');
        }

        // Auto-navigate after a short delay
        if (result.meetingId) {
          setTimeout(() => {
            router.push(`/meeting-details?id=${result.meetingId}`);
          }, 2000);
        }
      }
    } catch (error) {
      toast.error('Failed to recover miting', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error;
    }
  };

  // Handle dialog close - clear session flag if no meetings left
  const handleDialogClose = () => {
    setShowRecoveryDialog(false);
    if (recoverableMeetings.length === 0) {
      sessionStorage.removeItem('recovery_dialog_shown');
    }
  };

  return (
    <TranscriptRecovery
      isOpen={showRecoveryDialog}
      onClose={handleDialogClose}
      recoverableMeetings={recoverableMeetings}
      onRecover={handleRecovery}
      onDelete={deleteRecoverableMeeting}
      onLoadPreview={loadMeetingTranscripts}
    />
  );
}

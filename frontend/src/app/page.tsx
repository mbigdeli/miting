'use client';
import { toast } from 'sonner';

import { useEffect } from 'react';
import { RecordingStatus } from '@/contexts/RecordingStateContext';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import Analytics from '@/lib/analytics';
import { StatusOverlays } from './_components/StatusOverlays';
import { SettingsModals } from './_components/SettingsModal';
import { TranscriptPanel } from './_components/TranscriptPanel';
import { HomeRecovery } from './_components/HomeRecovery';
import { useRecordScreen } from './_components/useRecordScreen';
import { ModelPicker } from '@/components/record/ModelPicker';
import { RecordHero } from '@/components/record/RecordHero';
import { RecordingHeader } from '@/components/record/RecordingHeader';
import { DeviceErrorAlert } from '@/components/record/DeviceErrorAlert';
import { TranscriptionOffNotice } from '@/components/record/TranscriptionOffNotice';
import { useLiveTranscriptionState } from '@/components/record/useLiveTranscriptionState';
import { HomeSuggestions } from '@/components/setup/HomeSuggestions';
import { LiveTranslationButton } from '@/components/record/LiveTranslationButton';
import { LiveTranslationProvider } from '@/contexts/LiveTranslationContext';
import { useTranslationEnabled } from '@/lib/translation/enabled';

/**
 * Record screen (mockups 2e + 2f): a start-recording hero when idle, and the
 * live transcript view (header + centered stream) while recording.
 */
export default function Home() {
  const { meetingTitle, transcripts, copyTranscript } = useTranscripts();
  const { openImportDialog } = useImportDialog();
  const {
    recordingState,
    controls,
    modals,
    messages,
    showModal,
    hideModal,
    permissions,
    sidebarCollapsed,
    isRecordingDisabled,
    isProcessingStop,
    showLiveView,
    barHeights,
    displayDuration,
  } = useRecordScreen();
  const { status, isStopping, isSaving, isPaused } = recordingState;
  const liveTranscription = useLiveTranscriptionState();
  const translationEnabled = useTranslationEnabled();
  // Only while lines are still coming; Meet companion sessions bring captions,
  // not local lines to translate.
  const showTranslation =
    translationEnabled && recordingState.isRecording && !recordingState.isCompanionSession;

  useEffect(() => {
    Analytics.trackPageView('home');
  }, []);

  return (
    <LiveTranslationProvider>
    <div className="relative flex h-screen flex-col bg-zinc-50 font-inter text-zinc-950">
      <SettingsModals modals={modals} messages={messages} onClose={hideModal} />
      <HomeRecovery
        pauseChecks={recordingState.isRecording || isStopping || isProcessingStop || isSaving}
      />

      {showLiveView ? (
        <>
          <RecordingHeader
            title={meetingTitle}
            durationSeconds={displayDuration}
            isPaused={isPaused}
            isActive={recordingState.isActive}
            barHeights={barHeights}
            showControls={recordingState.isRecording}
            isStopping={isStopping || controls.isStopping}
            isPausing={controls.isPausing}
            isResuming={controls.isResuming}
            onPauseResume={controls.handlePauseResume}
            onStop={controls.handleStop}
            isCompanionSession={recordingState.isCompanionSession}
            onCompanionStopBlocked={() =>
              toast.info('Stop this miting from Google Meet', {
                description:
                  'The transcript comes from the Meet tab. Press stop in the Meet toolbar, or close the tab.',
                duration: 8000,
              })
            }
            showCopy={transcripts.length > 0}
            onCopy={copyTranscript}
            showLanguage
            onLanguage={() => showModal('languageSettings')}
            translation={showTranslation ? <LiveTranslationButton /> : null}
          />
          {liveTranscription.state !== 'active' && (
            <div className="px-7 pb-2">
              <TranscriptionOffNotice status={liveTranscription} />
            </div>
          )}
          <TranscriptPanel isProcessingStop={isProcessingStop} isStopping={isStopping} />
        </>
      ) : (
        <>
          {/* Floats over the hero so the centered column uses the full height. */}
          <div className="absolute right-7 top-5 z-40">
            <ModelPicker />
          </div>
          <RecordHero
            onStart={controls.handleStart}
            onImport={() => openImportDialog()}
            startDisabled={
              isRecordingDisabled || (!permissions.hasMicrophone && !permissions.isChecking)
            }
            isStarting={controls.isStarting || status === RecordingStatus.STARTING}
            below={<HomeSuggestions />}
          >
            <DeviceErrorAlert error={controls.deviceError} onDismiss={controls.clearDeviceError} />
          </RecordHero>
        </>
      )}

      <StatusOverlays
        isProcessing={
          status === RecordingStatus.PROCESSING_TRANSCRIPTS && !recordingState.isRecording
        }
        isSaving={status === RecordingStatus.SAVING}
        sidebarCollapsed={sidebarCollapsed}
      />
    </div>
    </LiveTranslationProvider>
  );
}

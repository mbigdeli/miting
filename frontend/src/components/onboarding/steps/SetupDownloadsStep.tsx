import React, { useCallback, useState } from 'react';
import { Mic, Sparkles, Loader2 } from 'lucide-react';
import { OnboardingContainer } from '../OnboardingContainer';
import { EngineDownloadCard } from './download/EngineDownloadCard';
import { useEngineDownload } from './download/useEngineDownload';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { toast } from 'sonner';
import { getSummaryModelSizeLabel, getSummaryModelSizeMb } from '@/lib/onboarding-summary-model';
import { useIsMac } from '../shared/useIsMac';

const PARAKEET_MODEL = 'parakeet-tdt-0.6b-v3-int8';
const PARAKEET_MB = 670;

/**
 * Offers the optional downloads instead of starting them.
 *
 * Both models used to download automatically on mount, and Continue stayed
 * disabled until the ~670 MB transcription engine finished — on a slow
 * connection that is a wall on first launch. Recording works without either
 * model now, so this step recommends them and gets out of the way.
 */
export function SetupDownloadsStep() {
  const {
    goNext,
    selectedSummaryModel,
    recommendedSummaryModel,
    parakeetDownloaded,
    setParakeetDownloaded,
    summaryModelDownloaded,
    setSummaryModelDownloaded,
    startBackgroundDownloads,
    completeOnboarding,
  } = useOnboarding();

  const isMac = useIsMac();
  const [isCompleting, setIsCompleting] = useState(false);

  const summaryModelName = selectedSummaryModel || recommendedSummaryModel;

  const parakeet = useEngineDownload({
    events: {
      progress: 'parakeet-model-download-progress',
      complete: 'parakeet-model-download-complete',
      error: 'parakeet-model-download-error',
    },
    matches: useCallback((payload) => payload.modelName === PARAKEET_MODEL, []),
    totalMb: PARAKEET_MB,
    alreadyDownloaded: parakeetDownloaded,
    start: () => startBackgroundDownloads({ includeParakeet: true, includeSummary: false }),
    onDownloaded: useCallback(() => setParakeetDownloaded(true), [setParakeetDownloaded]),
  });

  const summary = useEngineDownload({
    events: { progress: 'builtin-ai-download-progress' },
    matches: useCallback(
      (payload) => !!summaryModelName && payload.model === summaryModelName,
      [summaryModelName]
    ),
    totalMb: getSummaryModelSizeMb(summaryModelName),
    alreadyDownloaded: summaryModelDownloaded,
    start: () =>
      startBackgroundDownloads({
        includeParakeet: false,
        includeSummary: true,
        summaryModel: summaryModelName!,
      }),
    onDownloaded: useCallback(() => setSummaryModelDownloaded(true), [setSummaryModelDownloaded]),
  });

  const anyDownloadRunning =
    parakeet.state.status === 'downloading' || summary.state.status === 'downloading';

  const handleContinue = async () => {
    if (anyDownloadRunning) {
      toast.info('Downloads will continue in the background', {
        description: 'You can start using Miting now.',
        duration: 5000,
      });
    }

    if (isMac) {
      goNext();
      return;
    }

    setIsCompleting(true);
    try {
      await completeOnboarding();
      await new Promise((resolve) => setTimeout(resolve, 100));
      window.location.reload();
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Failed to complete setup', { description: 'Please try again.' });
      setIsCompleting(false);
    }
  };

  const summarySizeLabel = getSummaryModelSizeLabel(summaryModelName);
  const summarySubtitle = summaryModelName
    ? [summaryModelName, summarySizeLabel].filter(Boolean).join(' · ')
    : 'Preparing recommendation…';

  return (
    <OnboardingContainer
      title="Add the models"
      step={3}
      totalSteps={isMac ? 4 : 3}
    >
      <div className="mt-8 grid w-full max-w-[480px] gap-3.5">
        <EngineDownloadCard
          title="Transcription engine"
          subtitle="Parakeet · ~670 MB · recommended"
          icon={<Mic className="h-[17px] w-[17px] text-zinc-600" />}
          state={parakeet.state}
          onDownload={() => void parakeet.begin()}
          onRetry={() => void parakeet.begin()}
        />

        <EngineDownloadCard
          title="Summary engine"
          subtitle={summarySubtitle}
          icon={<Sparkles className="h-[17px] w-[17px] text-brand" />}
          state={summary.state}
          onDownload={summaryModelName ? () => void summary.begin() : undefined}
          onRetry={() => void summary.begin()}
        />
      </div>

      <button
        type="button"
        onClick={handleContinue}
        disabled={isCompleting}
        className="mt-7 flex h-11 w-[280px] items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
      </button>

      {anyDownloadRunning && (
        <p className="mt-2.5 text-xs text-zinc-400">Downloads keep running in the background.</p>
      )}
    </OnboardingContainer>
  );
}

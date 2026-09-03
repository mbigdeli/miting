import { useEffect, useRef } from 'react';

interface AutoGenerateOpts {
  shouldAutoGenerate: boolean;
  meetingId: string;
  transcriptsCount: number;
  provider: string;
  model: string;
  generate: (customPrompt: string) => Promise<void>;
  onComplete?: () => void;
}

/**
 * Auto-generate the summary once when arriving from a finished recording.
 * Extracted from the legacy PageContent effect; deliberately re-runs only on
 * [shouldAutoGenerate, meetingId] (latest values read through a ref) so a
 * changing generate identity can't double-fire generation.
 */
export function useAutoGenerateSummary(opts: AutoGenerateOpts) {
  const { shouldAutoGenerate, meetingId } = opts;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let cancelled = false;

    const autoGenerate = async () => {
      const o = optsRef.current;
      if (shouldAutoGenerate && o.transcriptsCount > 0 && !cancelled) {
        console.log(`🤖 Auto-generating summary with ${o.provider}/${o.model}...`);
        await o.generate('');

        // Notify parent that auto-generation is complete (only if not cancelled).
        if (o.onComplete && !cancelled) {
          o.onComplete();
        }
      }
    };

    autoGenerate();

    // Cleanup: cancel if component unmounts or meeting changes.
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoGenerate, meetingId]);
}

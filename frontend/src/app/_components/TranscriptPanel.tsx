import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useLiveCaptions } from '@/contexts/LiveCaptionsContext';
import { useMemo } from 'react';
import { useLiveTranslation } from '@/contexts/LiveTranslationContext';
import { languageName } from '@/lib/translation/languages';
import { liveTranslationFor, newestTranslated } from '@/lib/translation/lineTranslation';
import type { LiveStatus } from '@/lib/translation/types';

/**
 * TranscriptPanel Component (mockup 2f body)
 *
 * Live transcript surface for the Record screen: a centered 680px column of
 * transcript segments (virtualized) with the "Listening…" footer strip.
 * Copy / language controls moved up into <RecordingHeader />.
 */

interface TranscriptPanelProps {
  // indicates stop-processing state for transcripts; derived from backend statuses.
  isProcessingStop: boolean;
  isStopping: boolean;
}

function footerText(isPaused: boolean, status: LiveStatus): string {
  if (isPaused) return 'Paused. Resume to keep transcribing';
  if (status.state === 'running' && status.language) {
    return `Listening… translating to ${languageName(status.language)} with ${status.provider ?? 'your AI'}`;
  }
  return 'Listening… transcript is saved continuously';
}

export function TranscriptPanel({ isProcessingStop, isStopping }: TranscriptPanelProps) {
  // Contexts
  const { transcripts, transcriptContainerRef } = useTranscripts();
  const { isRecording, isPaused } = useRecordingState();
  const { showConfidenceIndicator } = useConfig();
  // A Meet session runs no local engine, so `transcripts` stays empty for the
  // whole call and this view showed "Listening for speech…" while the captions
  // were arriving and being stored. These come straight from the ingest server.
  const liveCaptions = useLiveCaptions();
  const translation = useLiveTranslation();
  const newest = useMemo(() => newestTranslated(translation.lines), [translation.lines]);

  // Convert transcripts to segments for virtualized view
  const segments = useMemo(
    () => {
      const shown = { ...translation.status, language: translation.shownLanguage };
      const local = transcripts.map(t => ({
        id: t.id,
        timestamp: t.audio_start_time ?? 0,
        endTime: t.audio_end_time,
        text: t.text,
        confidence: t.confidence,
        translation: liveTranslationFor(t.sequence_id, translation.lines, shown, newest),
      }));
      if (liveCaptions.length === 0) {
        return local;
      }
      // Only one of the two ever has content: a session is either local or
      // companion. Appending rather than replacing keeps that an assumption
      // this component does not have to enforce.
      return [
        ...local,
        ...liveCaptions.map((c, index) => ({
          id: `gmeet-${c.id}`,
          // The second the line began, from the recorder's own clock; index
          // only as a last resort for an event that arrived without one.
          timestamp: c.at ?? index,
          endTime: undefined,
          text: c.speaker ? `${c.speaker}: ${c.text}` : c.text,
          confidence: undefined,
        })),
      ];
    },
    [transcripts, liveCaptions, translation.lines, translation.status, translation.shownLanguage, newest]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Transcript stream (transcriptContainerRef keeps context auto-scroll working) */}
      <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto px-8 py-[26px]">
        <div className="mx-auto h-full w-full max-w-[680px]">
          <VirtualizedTranscriptView
            segments={segments}
            isRecording={isRecording}
            isPaused={isPaused}
            isProcessing={isProcessingStop}
            isStopping={isStopping}
            enableStreaming={isRecording}
            showConfidence={showConfidenceIndicator}
          />
        </div>
      </div>

      {/* Footer strip */}
      <div className="border-t border-zinc-200 bg-white p-3 text-center text-xs text-zinc-400">
        {footerText(isPaused, translation.status)}
      </div>
    </div>
  );
}

'use client';

import { useState, type ReactNode } from 'react';
import { Copy, RefreshCw, Search } from 'lucide-react';
import Analytics from '@/lib/analytics';
import { useConfig } from '@/contexts/ConfigContext';
import { RetranscribeDialog } from '../RetranscribeDialog';

interface TranscriptSearchRowProps {
  query: string;
  onQueryChange: (value: string) => void;
  canCopy: boolean;
  onCopyTranscript: () => void | Promise<void>;
  meetingId?: string;
  meetingFolderPath?: string | null;
  onRefetchTranscripts?: () => Promise<void>;
  /** Translate menu, shown before Copy. */
  translate?: ReactNode;
}

/** Search-in-transcript input plus the Copy / Enhance actions (mockups 2i / 2r). */
export default function TranscriptSearchRow(props: TranscriptSearchRowProps) {
  const { betaFeatures } = useConfig();
  const [showRetranscribe, setShowRetranscribe] = useState(false);
  const canEnhance =
    betaFeatures.importAndRetranscribe && !!props.meetingId && !!props.meetingFolderPath;

  const iconBtn =
    'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50';

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          placeholder="Search in transcript"
          className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-[34px] pr-3 text-[13px] text-zinc-950 placeholder:text-zinc-400 focus:border-brand focus:outline-none"
        />
      </div>
      {props.translate}
      <button
        type="button"
        title={props.canCopy ? 'Copy transcript' : 'No transcript available'}
        disabled={!props.canCopy}
        className={iconBtn}
        onClick={() => {
          Analytics.trackButtonClick('copy_transcript', 'meeting_details');
          void props.onCopyTranscript();
        }}
      >
        <Copy size={15} />
      </button>
      {canEnhance && (
        <>
          <button
            type="button"
            title="Retranscribe to enhance your recorded audio"
            className={iconBtn}
            onClick={() => {
              Analytics.trackButtonClick('enhance_transcript', 'meeting_details');
              setShowRetranscribe(true);
            }}
          >
            <RefreshCw size={15} />
          </button>
          <RetranscribeDialog
            open={showRetranscribe}
            onOpenChange={setShowRetranscribe}
            meetingId={props.meetingId!}
            meetingFolderPath={props.meetingFolderPath!}
            onComplete={async () => {
              if (props.onRefetchTranscripts) await props.onRefetchTranscripts();
            }}
          />
        </>
      )}
    </div>
  );
}

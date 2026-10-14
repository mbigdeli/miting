'use client';

import { memo } from 'react';
import type { SegmentTranslation } from '@/lib/translation/types';
import { isRtlText } from '@/lib/rtl';
import { ConfidenceIndicator } from '../ConfidenceIndicator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { TranslationLine } from '../translation/TranslationLine';
import { LineCards, LineText, useTranscriptDecor } from '../notes/TranscriptDecor';
import { LiveSpeakerTag } from './LiveSpeakerTag';

// Helper function to format seconds as recording-relative time [MM:SS]
function formatRecordingTime(seconds: number | undefined): string {
    if (seconds === undefined) return '[--:--]';

    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    return `[${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
}

// Helper function to remove filler words and repetitions
function cleanStopWords(text: string): string {
    const stopWords = ['uh', 'um', 'er', 'ah', 'hmm', 'hm', 'eh', 'oh'];

    let cleanedText = text;
    stopWords.forEach(word => {
        const pattern = new RegExp(`\\b${word}\\b[,\\s]*`, 'gi');
        cleanedText = cleanedText.replace(pattern, ' ');
    });

    return cleanedText.replace(/\s+/g, ' ').trim();
}


/** One transcript line: timestamp (confidence on hover), text, translation. */
export const TranscriptSegment = memo(function TranscriptSegment({
    id,
    timestamp,
    text,
    confidence,
    isStreaming,
    showConfidence,
    translation,
    live = false,
}: {
    id: string;
    timestamp: number;
    text: string;
    confidence?: number;
    isStreaming: boolean;
    showConfidence: boolean;
    translation?: SegmentTranslation;
    /** Recording in progress: show the live speaker tag. */
    live?: boolean;
}) {
    const displayText = cleanStopWords(text) || (text.trim() === '' ? '[Silence]' : text);
    const rtl = isRtlText(displayText);
    const decor = useTranscriptDecor();
    const playing = decor?.activeKey === id;
    const seek = decor?.seek;

    // ph-no-capture: meeting content stays out of session replays
    return (
        <div
            id={`segment-${id}`}
            data-line-at={timestamp}
            className={`ph-no-capture mb-3 ${playing ? '-mx-2 rounded-md bg-[#F6FAF9] px-2 shadow-[inset_2px_0_0_#9CC9C3]' : ''}`}
        >
            <div className="flex items-start gap-2">
                <Tooltip>
                    <TooltipTrigger>
                        <span
                            className={`text-xs text-gray-400 mt-1 flex-shrink-0 min-w-[50px] ${seek ? 'cursor-pointer hover:text-zinc-700' : ''}`}
                            onClick={seek ? () => seek(timestamp) : undefined}
                        >
                            {formatRecordingTime(timestamp)}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        {confidence !== undefined && showConfidence && (
                            <ConfidenceIndicator confidence={confidence} showIndicator={showConfidence} />
                        )}
                    </TooltipContent>
                </Tooltip>
                <div className="min-w-0 flex-1">
                    {live && <LiveSpeakerTag at={timestamp} />}
                    <div
                        className={rtl ? 'font-vazir text-right' : 'text-left'}
                        dir={rtl ? 'rtl' : 'ltr'}
                    >
                        {isStreaming ? (
                            <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                                <p className="text-base text-gray-800 leading-relaxed"><LineText text={displayText} /></p>
                            </div>
                        ) : (
                            <p className="text-base text-gray-800 leading-relaxed"><LineText text={displayText} /></p>
                        )}
                    </div>
                    <TranslationLine translation={translation} />
                    <LineCards lineKey={id} />
                </div>
            </div>
        </div>
    );
});

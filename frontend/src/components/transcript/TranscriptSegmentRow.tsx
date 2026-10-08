'use client';

import { memo } from 'react';
import type { SegmentTranslation } from '@/lib/translation/types';
import { isRtlText } from '@/lib/rtl';
import { ConfidenceIndicator } from '../ConfidenceIndicator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { TranslationLine } from '../translation/TranslationLine';

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
}: {
    id: string;
    timestamp: number;
    text: string;
    confidence?: number;
    isStreaming: boolean;
    showConfidence: boolean;
    translation?: SegmentTranslation;
}) {
    const displayText = cleanStopWords(text) || (text.trim() === '' ? '[Silence]' : text);
    const rtl = isRtlText(displayText);

    // ph-no-capture: meeting content stays out of session replays
    return (
        <div id={`segment-${id}`} className="ph-no-capture mb-3">
            <div className="flex items-start gap-2">
                <Tooltip>
                    <TooltipTrigger>
                        <span className="text-xs text-gray-400 mt-1 flex-shrink-0 min-w-[50px]">
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
                    <div
                        className={rtl ? 'font-vazir text-right' : 'text-left'}
                        dir={rtl ? 'rtl' : 'ltr'}
                    >
                        {isStreaming ? (
                            <div className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                                <p className="text-base text-gray-800 leading-relaxed">{displayText}</p>
                            </div>
                        ) : (
                            <p className="text-base text-gray-800 leading-relaxed">{displayText}</p>
                        )}
                    </div>
                    <TranslationLine translation={translation} />
                </div>
            </div>
        </div>
    );
});

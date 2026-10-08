import React from 'react';

const LINK = 'border-b border-dotted border-zinc-300 hover:text-zinc-800';

/** What Miting actually gives you, in the About panel. */
function features(openUrl: (url: string) => void): React.ReactNode[] {
    return [
        'Records mic + system audio, fully on your machine',
        'Local transcription: nothing leaves your computer',
        'Summaries with your ChatGPT or Claude plan, no API key',
        'Google Meet captions via the extension: sharper text, less compute',
        // `bdi` + nowrap keeps the bidi algorithm from flipping the closing
        // paren and stops the pair breaking across lines.
        <>
            <span className="whitespace-nowrap">
                Persian (<bdi className="font-vazir">فارسی</bdi>)
            </span>{' '}
            transcription &amp; RTL, first-class
        </>,
        'Free & open: no seats, no subscription',
    ];
}

export function AboutFeatures({ openUrl }: { openUrl: (url: string) => void }) {
    return (
        <ul className="mb-4 grid gap-2 rounded-[10px] border border-zinc-100 bg-zinc-50 px-4 py-3.5">
            {features(openUrl).map((feature, index) => (
                <li key={index} className="flex items-baseline gap-2 text-[12.5px] text-zinc-600">
                    <span className="h-[5px] w-[5px] shrink-0 -translate-y-0.5 rounded-full bg-brand" />
                    <span>{feature}</span>
                </li>
            ))}
        </ul>
    );
}

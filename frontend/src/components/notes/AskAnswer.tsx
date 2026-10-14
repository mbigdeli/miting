'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { linkTimes } from '@/lib/notes/detect';

/** An Ask AI answer: short Markdown, each cited moment a clickable chip. */
export function AskAnswer({ markdown, onSeek }: { markdown: string; onSeek?: (sec: number) => void }) {
  return (
    <div
      dir="auto"
      className="text-[13.5px] leading-relaxed text-zinc-700 [unicode-bidi:plaintext] [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const sec = href?.startsWith('#t=') ? Number(href.slice(3)) : NaN;
            if (Number.isFinite(sec)) {
              return (
                <button
                  type="button"
                  onClick={() => onSeek?.(sec)}
                  disabled={!onSeek}
                  className="mx-0.5 rounded-full border border-zinc-200 bg-zinc-50 px-1.5 align-[1px] text-[11px] tabular-nums text-zinc-600 hover:border-zinc-400 disabled:cursor-default disabled:hover:border-zinc-200"
                >
                  {children}
                </button>
              );
            }
            return <span className="underline decoration-zinc-300">{children}</span>;
          },
        }}
      >
        {linkTimes(markdown)}
      </ReactMarkdown>
    </div>
  );
}

'use client';

/** Transcript-content search hits shown under the main table. */

interface TranscriptMatch {
  id: string;
  title: string;
  matchContext: string;
}

export function TranscriptMatches({
  matches,
  onOpen,
}: {
  matches: TranscriptMatch[];
  onOpen: (id: string, title: string) => void;
}) {
  if (matches.length === 0) return null;
  return (
    <ul className="divide-y divide-zinc-100 border-t border-zinc-200">
      {matches.map((r) => (
        <li key={`t-${r.id}`}>
          <button
            type="button"
            onClick={() => onOpen(r.id, r.title)}
            className="flex w-full flex-col gap-0.5 px-5 py-3.5 text-left hover:bg-zinc-50"
          >
            <span className="truncate text-sm font-medium text-zinc-900">{r.title}</span>
            <span className="truncate text-xs text-zinc-500">Match: {r.matchContext}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

'use client';

/**
 * Mitings library: sortable Name/Status/Date table with a status filter.
 * Search matches titles instantly and full transcript text via
 * api_search_transcripts (debounced), same as the legacy sidebar search.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdSearch, MdOutlineEventBusy } from 'react-icons/md';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { captureProduct } from '@/lib/productEvents';
import { MeetingsTable } from './MeetingsTable';
import { TranscriptMatches } from './TranscriptMatches';
import {
  DEFAULT_SORT,
  filterRows,
  nextSort,
  sortRows,
  SortState,
  StatusFilter,
} from './tableModel';

export default function MeetingsPage() {
  const { meetings, meetingStatuses, enhancingMeetings, setCurrentMeeting, searchTranscripts, searchResults } =
    useSidebar();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  // Debounced full-text transcript search alongside the instant title filter.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => void searchTranscripts(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const titleMatches = q ? meetings.filter((m) => m.title.toLowerCase().includes(q)) : meetings;
    return sortRows(filterRows(titleMatches, statusFilter, meetingStatuses), sort, meetingStatuses);
  }, [meetings, query, statusFilter, sort, meetingStatuses]);

  const transcriptOnly = useMemo(() => {
    const seen = new Set(rows.map((m) => m.id));
    return searchResults.filter((r) => !seen.has(r.id));
  }, [rows, searchResults]);

  const openMeeting = (id: string, title: string) => {
    captureProduct('meeting_opened');
    setCurrentMeeting({ id, title });
    router.push(`/meeting-details?id=${id}`);
  };

  const empty = rows.length === 0 && (!query || transcriptOnly.length === 0);

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Mitings</h1>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="cursor-pointer rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-2 text-[13px] text-zinc-700 focus:border-brand focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="summarized">Summarized</option>
            <option value="not-summarized">Not summarized</option>
          </select>
          <div className="relative w-64">
            <MdSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles and transcripts…"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {empty ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <MdOutlineEventBusy size={22} className="text-zinc-300" />
            <h2 className="text-base font-semibold text-zinc-900">
              {query ? `No results for "${query}"` : 'No mitings yet'}
            </h2>
            <p className="max-w-sm text-[13px] text-zinc-500">
              {query
                ? 'Try a different search term.'
                : statusFilter !== 'all'
                  ? 'Nothing matches this status filter.'
                  : 'Start a recording from the Record tab and your mitings will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <MeetingsTable
              rows={rows}
              statuses={meetingStatuses}
              enhancing={enhancingMeetings}
              sort={sort}
              onSort={(key) => setSort((s) => nextSort(s, key))}
              onOpen={openMeeting}
            />
            <TranscriptMatches matches={transcriptOnly} onOpen={openMeeting} />
          </>
        )}
      </div>
    </div>
  );
}

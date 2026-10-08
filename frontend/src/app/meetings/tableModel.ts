/** Pure sort/filter helpers for the Mitings table (name · status · date). */

import type { MeetingStatus } from '@/components/Sidebar/SidebarProvider';

export interface MeetingRow {
  id: string;
  title: string;
  created_at?: string;
}

export type SortKey = 'title' | 'status' | 'date';
export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: SortKey;
  dir: SortDir;
}
export type StatusFilter = 'all' | 'summarized' | 'not-summarized';

export const DEFAULT_SORT: SortState = { key: 'date', dir: 'desc' };

/** First click per column: newest first, summarized first, A→Z. */
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  title: 'asc',
  status: 'desc',
  date: 'desc',
};

export const isSummarized = (status?: MeetingStatus): boolean =>
  (status?.summary_status ?? '').toLowerCase() === 'completed';

export function nextSort(current: SortState, clicked: SortKey): SortState {
  if (current.key === clicked) {
    return { key: clicked, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key: clicked, dir: DEFAULT_DIR[clicked] };
}

export function filterRows(
  rows: MeetingRow[],
  filter: StatusFilter,
  statuses: Record<string, MeetingStatus>,
): MeetingRow[] {
  if (filter === 'all') return rows;
  return rows.filter((row) =>
    filter === 'summarized' ? isSummarized(statuses[row.id]) : !isSummarized(statuses[row.id]),
  );
}

const dateValue = (row: MeetingRow): number => {
  const t = row.created_at ? Date.parse(row.created_at) : Number.NaN;
  return Number.isNaN(t) ? 0 : t;
};

export function sortRows(
  rows: MeetingRow[],
  sort: SortState,
  statuses: Record<string, MeetingStatus>,
): MeetingRow[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sort.key) {
      case 'title':
        return sign * a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      case 'status': {
        const diff = Number(isSummarized(statuses[a.id])) - Number(isSummarized(statuses[b.id]));
        // Equal status → keep newest first for stability of the view.
        return diff !== 0 ? sign * diff : dateValue(b) - dateValue(a);
      }
      case 'date':
        return sign * (dateValue(a) - dateValue(b));
    }
  });
}

export function formatRowDate(createdAt?: string): string {
  if (!createdAt) return 'Unknown';
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 'Unknown';
  return new Date(t).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

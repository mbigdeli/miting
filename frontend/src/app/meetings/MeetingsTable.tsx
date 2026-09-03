'use client';

/** Sortable Mitings table: Name · Status · Date columns. */

import { MdArrowDownward, MdArrowUpward } from 'react-icons/md';
import { MeetingStatusChip } from '@/components/Sidebar/MeetingStatusChip';
import type { MeetingStatus } from '@/components/Sidebar/SidebarProvider';
import { formatRowDate, MeetingRow, SortKey, SortState } from './tableModel';

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: 'title', label: 'Name', className: 'flex-1 text-left' },
  { key: 'status', label: 'Status', className: 'w-32 text-left' },
  { key: 'date', label: 'Date', className: 'w-28 text-right' },
];

export function MeetingsTable({
  rows,
  statuses,
  enhancing,
  sort,
  onSort,
  onOpen,
}: {
  rows: MeetingRow[];
  statuses: Record<string, MeetingStatus>;
  enhancing: Set<string>;
  sort: SortState;
  onSort: (key: SortKey) => void;
  onOpen: (id: string, title: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/60 px-5 py-2">
        {COLUMNS.map(({ key, label, className }) => {
          const active = sort.key === key;
          const Arrow = sort.dir === 'asc' ? MdArrowUpward : MdArrowDownward;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSort(key)}
              aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              className={`${className} inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.5px] ${
                active ? 'text-zinc-700' : 'text-zinc-400 hover:text-zinc-600'
              } ${key === 'date' ? 'justify-end' : ''}`}
            >
              {label}
              {active && <Arrow size={12} />}
            </button>
          );
        })}
      </div>
      <ul className="divide-y divide-zinc-100">
        {rows.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onOpen(m.id, m.title)}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-zinc-50"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
                {m.title}
              </span>
              <span className="w-32 shrink-0">
                <MeetingStatusChip status={statuses[m.id]} enhancing={enhancing.has(m.id)} />
              </span>
              <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums text-zinc-500">
                {formatRowDate(m.created_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

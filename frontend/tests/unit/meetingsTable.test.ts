import { describe, expect, test } from 'vitest';
import {
  DEFAULT_SORT,
  filterRows,
  formatRowDate,
  isSummarized,
  nextSort,
  sortRows,
} from '@/app/meetings/tableModel';

const rows = [
  { id: 'a', title: 'Beta sync', created_at: '2026-07-24T02:08:00Z' },
  { id: 'b', title: 'alpha standup', created_at: '2026-08-01T10:00:00Z' },
  { id: 'c', title: 'Client call' }, // legacy row without a date
];
const statuses = {
  a: { summary_status: 'completed', diarized: false },
  b: { summary_status: null, diarized: false },
};

describe('filterRows', () => {
  test('all keeps everything', () => {
    expect(filterRows(rows, 'all', statuses)).toHaveLength(3);
  });
  test('summarized keeps only completed summaries', () => {
    expect(filterRows(rows, 'summarized', statuses).map((r) => r.id)).toEqual(['a']);
  });
  test('not-summarized keeps the rest (including unknown status)', () => {
    expect(filterRows(rows, 'not-summarized', statuses).map((r) => r.id)).toEqual(['b', 'c']);
  });
});

describe('sortRows', () => {
  test('default sort is date, newest first, undated rows last', () => {
    expect(sortRows(rows, DEFAULT_SORT, statuses).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });
  test('title sort is case-insensitive', () => {
    expect(sortRows(rows, { key: 'title', dir: 'asc' }, statuses).map((r) => r.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });
  test('status desc puts summarized first', () => {
    expect(sortRows(rows, { key: 'status', dir: 'desc' }, statuses)[0].id).toBe('a');
  });
  test('does not mutate its input', () => {
    const input = [...rows];
    sortRows(input, { key: 'title', dir: 'asc' }, statuses);
    expect(input.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('nextSort', () => {
  test('clicking the active column flips direction', () => {
    expect(nextSort({ key: 'date', dir: 'desc' }, 'date')).toEqual({ key: 'date', dir: 'asc' });
  });
  test('clicking a new column applies its default direction', () => {
    expect(nextSort({ key: 'date', dir: 'desc' }, 'title')).toEqual({ key: 'title', dir: 'asc' });
    expect(nextSort({ key: 'title', dir: 'asc' }, 'status')).toEqual({ key: 'status', dir: 'desc' });
  });
});

describe('formatRowDate / isSummarized', () => {
  test('formats to a short date and dashes invalid input', () => {
    expect(formatRowDate('2026-07-24T02:08:00Z')).toMatch(/Jul 2[34], 2026/);
    expect(formatRowDate(undefined)).toBe('—');
    expect(formatRowDate('not-a-date')).toBe('—');
  });
  test('isSummarized only for completed', () => {
    expect(isSummarized({ summary_status: 'completed', diarized: false })).toBe(true);
    expect(isSummarized({ summary_status: 'PENDING', diarized: false })).toBe(false);
    expect(isSummarized(undefined)).toBe(false);
  });
});

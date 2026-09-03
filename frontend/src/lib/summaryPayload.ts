/**
 * Pure parsing of the `api_get_summary` payload into what the detail view
 * renders. Extracted from the meeting-details page so both the initial fetch
 * and the live `summary-status-changed` refresh share one implementation.
 */

import type { Summary, Section } from '@/types';

export interface SummaryResponseLike {
  status?: string;
  data?: unknown;
  error?: string | null;
}

/** Terminal statuses whose payload is worth re-reading from the database. */
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'error']);

export const isTerminalSummaryStatus = (status?: string | null): boolean =>
  TERMINAL_STATUSES.has((status ?? '').toLowerCase());

function asRecord(value: unknown): Record<string, any> | null {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, any>) : null;
}

/** Normalises one legacy `{ title, blocks }` section; null when unusable. */
function normaliseSection(key: string, raw: unknown): Section | null {
  if (!raw || typeof raw !== 'object') return null;
  const section = raw as { title?: string; blocks?: unknown };
  if (!('title' in section) || !('blocks' in section)) return null;

  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  return {
    title: section.title || key,
    blocks: blocks.map((block: any) => ({
      ...block,
      color: 'default',
      content: block?.content?.trim() || '',
    })),
  };
}

/**
 * Returns the renderable summary, or null when the meeting has none yet.
 * `cancelled`/`failed` can still carry data — the backend restores the previous
 * summary from its backup — so those are parsed rather than discarded.
 */
export function parseSummaryResponse(response: SummaryResponseLike | null | undefined): Summary | null {
  if (!response) return null;

  const status = (response.status ?? '').toLowerCase();
  if (status === 'idle') return null;
  if (!response.data && status === 'error') return null;

  const data = asRecord(response.data);
  if (!data) return null;

  // BlockNote JSON and markdown are already in their final shape.
  if (data.summary_json || data.markdown) return data as unknown as Summary;

  const { MeetingName, _section_order, ...sections } = data;
  const keys: string[] = Array.isArray(_section_order) ? _section_order : Object.keys(sections);

  const formatted: Summary = {};
  for (const key of keys) {
    const section = normaliseSection(key, sections[key]);
    if (section) formatted[key] = section;
  }

  return Object.keys(formatted).length > 0 ? formatted : null;
}

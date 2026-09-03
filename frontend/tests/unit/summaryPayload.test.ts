import { describe, expect, it } from 'vitest';
import { isTerminalSummaryStatus, parseSummaryResponse } from '@/lib/summaryPayload';

describe('isTerminalSummaryStatus', () => {
  it('accepts every status that carries a final payload', () => {
    for (const status of ['completed', 'failed', 'cancelled', 'error', 'COMPLETED']) {
      expect(isTerminalSummaryStatus(status)).toBe(true);
    }
  });

  it('rejects in-flight and missing statuses', () => {
    expect(isTerminalSummaryStatus('pending')).toBe(false);
    expect(isTerminalSummaryStatus('idle')).toBe(false);
    expect(isTerminalSummaryStatus(undefined)).toBe(false);
  });
});

describe('parseSummaryResponse', () => {
  it('returns null before any summary exists', () => {
    expect(parseSummaryResponse({ status: 'idle', data: null })).toBeNull();
    expect(parseSummaryResponse(null)).toBeNull();
  });

  it('returns null for an error with no restored payload', () => {
    expect(parseSummaryResponse({ status: 'error', data: null, error: 'boom' })).toBeNull();
  });

  it('passes markdown payloads through untouched', () => {
    const data = { markdown: '## Decisions\nShip it', english_cache: { markdown: 'x' } };
    expect(parseSummaryResponse({ status: 'completed', data })).toBe(data as any);
  });

  it('passes BlockNote payloads through untouched', () => {
    const data = { summary_json: [{ id: '1', type: 'paragraph' }] };
    expect(parseSummaryResponse({ status: 'completed', data })).toBe(data as any);
  });

  it('parses a double-encoded JSON string payload', () => {
    const response = { status: 'completed', data: JSON.stringify({ markdown: '# Hi' }) };
    expect(parseSummaryResponse(response)).toEqual({ markdown: '# Hi' });
  });

  it('keeps a restored summary on a cancelled run', () => {
    const data = { markdown: 'previous summary' };
    expect(parseSummaryResponse({ status: 'cancelled', data })).toEqual(data);
  });

  it('formats legacy sections and honours _section_order', () => {
    const result = parseSummaryResponse({
      status: 'completed',
      data: {
        MeetingName: 'Standup',
        _section_order: ['b', 'a'],
        a: { title: 'A', blocks: [{ id: '1', type: 'bullet', content: ' padded ' }] },
        b: { title: 'B', blocks: [] },
      },
    });

    expect(Object.keys(result!)).toEqual(['b', 'a']);
    expect(result!.a.blocks[0]).toMatchObject({ content: 'padded', color: 'default' });
    expect(result).not.toHaveProperty('MeetingName');
  });

  it('drops sections whose blocks are not an array rather than crashing', () => {
    const result = parseSummaryResponse({
      status: 'completed',
      data: { a: { title: 'A', blocks: 'nope' }, b: { title: 'B', blocks: [] } },
    });

    expect(result!.a.blocks).toEqual([]);
    expect(result!.b.blocks).toEqual([]);
  });

  it('returns null when a legacy payload has no usable section', () => {
    expect(parseSummaryResponse({ status: 'completed', data: { MeetingName: 'x' } })).toBeNull();
  });

  it('survives malformed JSON strings', () => {
    expect(parseSummaryResponse({ status: 'completed', data: '{ nope' })).toBeNull();
  });
});

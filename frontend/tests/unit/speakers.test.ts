import { describe, expect, test } from 'vitest';
import {
  checkName,
  hasMeetNames,
  isAcoustic,
  mergeTargets,
  sideLabel,
  sourceBadge,
  stageText,
  talkShare,
  type SpeakerInfo,
} from '../../src/lib/speakers';

const speaker = (name: string, secs: number, source: SpeakerInfo['name_source'] = 'auto'): SpeakerInfo => ({
  name,
  label: source === 'meet' ? null : name,
  name_source: source,
  ai_evidence: null,
  speech_secs: secs,
  segment_count: 1,
  sample_start_sec: 1,
  sample_end_sec: 7,
});

const all = [speaker('Speaker 1', 75), speaker('علی', 25, 'ai')];

describe('checkName', () => {
  test('trims and accepts a new Persian name', () => {
    expect(checkName('  سارا ', 'Speaker 1', all)).toEqual({ ok: true, name: 'سارا', merges: false });
  });

  test('flags a merge when the name belongs to another speaker', () => {
    expect(checkName('علی', 'Speaker 1', all)).toEqual({ ok: true, name: 'علی', merges: true });
  });

  test('keeping the same name is not a merge', () => {
    expect(checkName('علی', 'علی', all)).toEqual({ ok: true, name: 'علی', merges: false });
  });

  test('rejects empty and overlong names', () => {
    expect(checkName('   ', 'Speaker 1', all).ok).toBe(false);
    expect(checkName('x'.repeat(81), 'Speaker 1', all).ok).toBe(false);
  });
});

describe('speaker facts', () => {
  test('talk share rounds to whole percent', () => {
    expect(talkShare(all[0], all)).toBe(75);
    expect(talkShare(speaker('x', 0), [speaker('x', 0)])).toBe(0);
  });

  test('merge targets are everyone else', () => {
    expect(mergeTargets('Speaker 1', all)).toEqual(['علی']);
  });

  test('Meet names are protected from acoustic re-runs', () => {
    expect(isAcoustic(all)).toBe(true);
    expect(hasMeetNames([speaker('Mina', 10, 'meet')])).toBe(true);
    expect(isAcoustic([speaker('Mina', 10, 'meet')])).toBe(false);
    expect(isAcoustic([])).toBe(false);
  });

  test('badges and stage text', () => {
    expect(sourceBadge('ai')).toBe('AI suggestion');
    expect(sourceBadge('user')).toBeNull();
    expect(stageText('listening')).toMatch(/voices/);
    expect(stageText('done')).toBeNull();
    expect(stageText(null)).toBeNull();
  });

  test('where a voice was heard', () => {
    expect(sideLabel('room')).toBeNull();
    expect(sideLabel('remote')).toBe('Remote');
    expect(sideLabel(null)).toBeNull();
    expect(sideLabel(undefined)).toBeNull();
  });
});

import { liveTag, speakerAt, type LiveSpeakerTurn } from '../../src/lib/liveSpeakers';

describe('live speaker tags', () => {
  const turns: LiveSpeakerTurn[] = [
    { start: 0, end: 10, speaker: 'Speaker 1', side: 'room' },
    { start: 12, end: 30, speaker: 'Speaker 2', side: 'remote' },
  ];

  test('a line takes the speaker it overlaps most', () => {
    expect(speakerAt(turns, 13, 14)?.speaker).toBe('Speaker 2');
    expect(liveTag(turns, 1, 2)).toBe('Speaker 1');
    expect(liveTag(turns, 13, 14)).toBe('Speaker 2 · Remote');
  });

  test('a line in a short gap takes the nearest speaker, far lines none', () => {
    expect(speakerAt(turns, 10.5, 11)?.speaker).toBe('Speaker 1');
    expect(liveTag(turns, 60, 61)).toBeNull();
    expect(liveTag([], 1, 2)).toBeNull();
  });
});

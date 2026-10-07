import { describe, expect, it } from 'vitest';
import { transcriptionStepReady } from '@/lib/transcriptionReady';

describe('transcriptionStepReady', () => {
  it('accepts any downloaded Parakeet or Whisper model, as the recorder does', () => {
    expect(transcriptionStepReady({ engine: 'parakeet', model: 'a', onDisk: ['b'] })).toBe(true);
    expect(transcriptionStepReady({ engine: 'whisper', model: 'a', onDisk: [] })).toBe(false);
  });

  it('needs the exact saved Shenava model on disk', () => {
    expect(transcriptionStepReady({ engine: 'shenava', model: 'koochik', onDisk: ['bozorg'] })).toBe(false);
    expect(transcriptionStepReady({ engine: 'shenava', model: 'koochik', onDisk: ['koochik'] })).toBe(true);
    expect(transcriptionStepReady({ engine: 'shenava', model: undefined, onDisk: ['koochik'] })).toBe(false);
  });

  it('is never ready for a provider that cannot record', () => {
    expect(transcriptionStepReady({ engine: undefined, model: 'nova', onDisk: [] })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  autoSaveWasForced,
  isFatalTranscriptionError,
  transcriptionErrorMessage,
  unavailableReason,
} from '@/lib/transcriptionEvents';

describe('isFatalTranscriptionError', () => {
  it('does not stop a meeting for the errors the backend emits today', () => {
    expect(
      isFatalTranscriptionError({
        error: 'chunk failed',
        userMessage: 'Transcription failed: chunk failed',
        actionable: false,
        fatal: false,
      })
    ).toBe(false);
  });

  it('treats a legacy payload with no severity as non-fatal', () => {
    expect(isFatalTranscriptionError({ error: 'boom' })).toBe(false);
    expect(isFatalTranscriptionError('plain string error')).toBe(false);
    expect(isFatalTranscriptionError(null)).toBe(false);
  });

  it('stops only when the backend explicitly says so', () => {
    expect(isFatalTranscriptionError({ error: 'boom', fatal: true })).toBe(true);
  });
});

describe('transcriptionErrorMessage', () => {
  it('prefers the user-facing message', () => {
    expect(transcriptionErrorMessage({ error: 'raw', userMessage: 'friendly' })).toBe('friendly');
    expect(transcriptionErrorMessage({ error: 'raw' })).toBe('raw');
  });

  it('falls back for string and empty payloads', () => {
    expect(transcriptionErrorMessage('boom')).toBe('boom');
    expect(transcriptionErrorMessage({})).toBe('Transcription failed');
  });
});

describe('transcription-unavailable payload', () => {
  it('carries the backend reason and the auto-save override', () => {
    const payload = { reason: 'No Parakeet models are available', autoSaveForced: true };
    expect(unavailableReason(payload)).toBe('No Parakeet models are available');
    expect(autoSaveWasForced(payload)).toBe(true);
  });

  it('degrades to a generic reason without one', () => {
    expect(unavailableReason({})).toBe('No transcription model is available');
    expect(autoSaveWasForced({})).toBe(false);
  });
});

import { describe, expect, test } from 'vitest';
import { isOllamaNotInstalledError, toErrorMessage } from '../../src/lib/utils';

/**
 * Tauri rejects with the Rust Err string. The old `err instanceof Error` guard
 * replaced it with a generic fallback, which both hid the reason from the user
 * and defeated the "is Ollama installed?" sniffing below.
 */
describe('toErrorMessage', () => {
  test('keeps a string rejection verbatim', () => {
    expect(toErrorMessage('Cannot connect to Ollama server')).toBe(
      'Cannot connect to Ollama server',
    );
  });

  test('reads Error.message', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  test('reads a message field off a plain object', () => {
    expect(toErrorMessage({ message: 'nested' })).toBe('nested');
  });

  test('serialises objects with no message', () => {
    expect(toErrorMessage({ code: 42 })).toBe('{"code":42}');
  });

  test('falls back only when there is genuinely nothing', () => {
    expect(toErrorMessage(null, 'Failed to download model')).toBe('Failed to download model');
    expect(toErrorMessage('   ', 'Failed to download model')).toBe('Failed to download model');
  });

  test('a string rejection still reaches the Ollama sniffing', () => {
    const raw = 'Cannot connect to Ollama server. Please check if the server is running.';
    expect(isOllamaNotInstalledError(toErrorMessage(raw))).toBe(true);
    // What the old code produced instead:
    expect(isOllamaNotInstalledError('Failed to download model')).toBe(false);
  });
});

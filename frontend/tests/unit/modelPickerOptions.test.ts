import { describe, expect, test } from 'vitest';
import {
  fromConfigProvider,
  modelKey,
  optionLabel,
  toConfigProvider,
} from '@/components/record/modelPickerOptions';

describe('provider mapping', () => {
  test('whisper maps to localWhisper in the saved config and back', () => {
    expect(toConfigProvider('whisper')).toBe('localWhisper');
    expect(fromConfigProvider('localWhisper')).toBe('whisper');
  });

  test('parakeet and shenava are unchanged', () => {
    expect(toConfigProvider('parakeet')).toBe('parakeet');
    expect(toConfigProvider('shenava')).toBe('shenava');
    expect(fromConfigProvider('shenava')).toBe('shenava');
    expect(fromConfigProvider(undefined)).toBe('');
  });
});

describe('optionLabel', () => {
  test('shows engine and model name', () => {
    expect(optionLabel({ provider: 'whisper', name: 'large-v3' })).toBe('Whisper · large-v3');
    expect(optionLabel({ provider: 'parakeet', name: 'tdt-0.6b-v2' })).toBe(
      'Parakeet · tdt-0.6b-v2',
    );
  });

  test('shenava is marked FA and prefers its display name', () => {
    expect(optionLabel({ provider: 'shenava', name: 'koochik', displayName: 'Koochik' })).toBe(
      'Shenava · Koochik — FA',
    );
  });
});

describe('modelKey', () => {
  test('is provider-scoped', () => {
    expect(modelKey('whisper', 'base')).toBe('whisper:base');
  });
});

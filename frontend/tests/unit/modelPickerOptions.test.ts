import { describe, expect, test } from 'vitest';
import {
  fromConfigProvider,
  modelKey,
  optionLabel,
  toConfigProvider,
  type PickerModel,
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
  const parakeet: PickerModel = { provider: 'parakeet', name: 'parakeet-tdt-0.6b-v3-int8' };
  const koochik: PickerModel = { provider: 'shenava', name: 'koochik', displayName: 'Koochik' };
  const turbo: PickerModel = { provider: 'whisper', name: 'large-v3-turbo' };
  const base: PickerModel = { provider: 'whisper', name: 'base' };

  test('shows the plain engine name when it is the only model of its engine', () => {
    const all = [parakeet, koochik, turbo];
    expect(optionLabel(parakeet, all)).toBe('Parakeet');
    expect(optionLabel(koochik, all)).toBe('Shenava');
    expect(optionLabel(turbo, all)).toBe('Whisper');
  });

  test('adds the model name when one engine has two models', () => {
    const all = [turbo, base, koochik];
    expect(optionLabel(turbo, all)).toBe('Whisper · large-v3-turbo');
    expect(optionLabel(base, all)).toBe('Whisper · base');
    expect(optionLabel(koochik, all)).toBe('Shenava');
  });

  test('prefers the display name and never shows a dash of its own', () => {
    const rizeh: PickerModel = { provider: 'shenava', name: 'rizeh', displayName: 'Rizeh' };
    expect(optionLabel(koochik, [koochik, rizeh])).toBe('Shenava · Koochik');
    expect(optionLabel(koochik)).not.toMatch(/[–—]/);
  });
});

describe('modelKey', () => {
  test('is provider-scoped', () => {
    expect(modelKey('whisper', 'base')).toBe('whisper:base');
  });
});

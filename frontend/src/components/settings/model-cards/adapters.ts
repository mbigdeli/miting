/** Per-engine adapters feeding the shared model cards. */

import { WhisperAPI } from '@/lib/whisper';
import { ParakeetAPI } from '@/lib/parakeet';
import { ShenavaAPI } from '@/lib/shenava';
import type { EngineAdapter, RawStatus } from './types';
import { normalizeStatus } from './types';

export const whisperAdapter: EngineAdapter = {
  configProvider: 'localWhisper',
  init: () => WhisperAPI.init(),
  list: async () =>
    (await WhisperAPI.getAvailableModels()).map((m) => ({
      name: m.name,
      displayName: m.name,
      sizeMb: m.size_mb,
      description: m.description ?? `${m.accuracy} accuracy · ${m.speed.toLowerCase()} processing`,
      status: normalizeStatus(m.status as RawStatus),
    })),
  download: (name) => WhisperAPI.downloadModel(name),
  cancelDownload: (name) => WhisperAPI.cancelDownload(name),
  removeCorrupted: async (name) => {
    await WhisperAPI.deleteCorruptedModel(name);
  },
  events: {
    progress: 'model-download-progress',
    complete: 'model-download-complete',
    error: 'model-download-error',
  },
};

export const parakeetAdapter: EngineAdapter = {
  configProvider: 'parakeet',
  init: () => ParakeetAPI.init(),
  list: async () =>
    (await ParakeetAPI.getAvailableModels()).map((m) => ({
      name: m.name,
      displayName: m.name,
      sizeMb: m.size_mb,
      description:
        m.description ?? `${m.accuracy} accuracy · ${m.speed.toLowerCase()} · ${m.quantization}`,
      status: normalizeStatus(m.status as RawStatus),
    })),
  download: (name) => ParakeetAPI.downloadModel(name),
  cancelDownload: (name) => ParakeetAPI.cancelDownload(name),
  removeCorrupted: async (name) => {
    await ParakeetAPI.deleteCorruptedModel(name);
  },
  events: {
    progress: 'parakeet-model-download-progress',
    complete: 'parakeet-model-download-complete',
    error: 'parakeet-model-download-error',
  },
};

export const shenavaAdapter: EngineAdapter = {
  configProvider: 'shenava',
  init: () => ShenavaAPI.init(),
  list: async () =>
    (await ShenavaAPI.models()).map((m) => ({
      name: m.name,
      displayName: `Shenava ${m.display_name}`,
      sizeMb: m.size_mb,
      description: `${m.description} · Persian only`,
      status: normalizeStatus(m.status as RawStatus),
    })),
  download: (name) => ShenavaAPI.download(name),
  removeCorrupted: (name) => ShenavaAPI.delete(name),
  events: {
    progress: 'shenava-model-download-progress',
    complete: 'shenava-model-download-complete',
    error: 'shenava-model-download-error',
  },
};

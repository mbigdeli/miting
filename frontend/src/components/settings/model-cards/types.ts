/** Engine-agnostic model card model + status normalisation. */

export type CardStatus =
  | { kind: 'available' }
  | { kind: 'missing' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'corrupted' }
  | { kind: 'error'; message: string };

export interface EngineModel {
  name: string;
  displayName: string;
  sizeMb: number;
  description?: string;
  status: CardStatus;
}

/** Raw status unions used by the whisper/parakeet/shenava commands. */
export type RawStatus =
  | 'Available'
  | 'Missing'
  | { Downloading: number | { progress: number } }
  | { Error: string }
  | { Corrupted: unknown };

export function normalizeStatus(raw: RawStatus): CardStatus {
  if (raw === 'Available') return { kind: 'available' };
  if (raw === 'Missing') return { kind: 'missing' };
  if (typeof raw === 'object') {
    if ('Downloading' in raw) {
      const value = raw.Downloading;
      return {
        kind: 'downloading',
        progress: typeof value === 'number' ? value : value.progress,
      };
    }
    if ('Error' in raw) return { kind: 'error', message: raw.Error };
    if ('Corrupted' in raw) return { kind: 'corrupted' };
  }
  return { kind: 'missing' };
}

export interface EngineAdapter {
  /** Provider id stored in transcript_settings (localWhisper / parakeet / shenava). */
  configProvider: string;
  init(): Promise<void>;
  list(): Promise<EngineModel[]>;
  download(name: string): Promise<void>;
  cancelDownload?(name: string): Promise<void>;
  /** Remove a corrupted download so it can be fetched again. */
  removeCorrupted?(name: string): Promise<void>;
  /** Event names; payloads carry `modelName` or `model_name` (engines disagree). */
  events: {
    progress: string;
    complete: string;
    error: string;
  };
}

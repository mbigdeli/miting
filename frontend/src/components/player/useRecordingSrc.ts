'use client';

import { useEffect, useRef, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

/**
 * A playable URL for a miting's `audio.mp4`. Streams from disk through the
 * asset protocol (the byte-array path re-buffers the whole file through JSON,
 * which stuttered); bytes stay as the fallback if the scope says no.
 */
export function useRecordingSrc(folderPath?: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(null);
    if (!folderPath) return;
    (async () => {
      try {
        const sep = folderPath.includes('\\') ? '\\' : '/';
        const filePath = `${folderPath}${sep}audio.mp4`;
        try {
          const streamed = convertFileSrc(filePath);
          const head = await fetch(streamed, { method: 'HEAD' });
          if (head.ok) {
            if (!cancelled) setSrc(streamed);
            return;
          }
        } catch {
          /* asset protocol refused: fall through to bytes */
        }
        const bytes = await invoke<number[]>('read_audio_file', { filePath });
        if (cancelled) return;
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'audio/mp4' }));
        urlRef.current = url;
        setSrc(url);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [folderPath]);

  return { src, error };
}

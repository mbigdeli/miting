'use client';

import { useEffect, useRef, useState } from 'react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { MdMusicNote } from 'react-icons/md';

/**
 * Play back the meeting's own recording.
 *
 * Every session writes `audio.mp4` into its folder, but nothing in the app ever
 * offered it — the file existed and there was no way to hear it. Reading the
 * bytes through Tauri avoids depending on asset-protocol scope for a path the
 * user chose.
 */
export function RecordingPlayer({ folderPath }: { folderPath?: string | null }) {
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
        // Stream from disk through the asset protocol: the byte-array path
        // re-buffers the whole file through JSON, which stuttered and read as
        // "noisy" playback. Bytes stay as the fallback if the scope says no.
        try {
          const streamed = convertFileSrc(filePath);
          const head = await fetch(streamed, { method: 'HEAD' });
          if (head.ok) {
            if (!cancelled) setSrc(streamed);
            return;
          }
        } catch {
          /* asset protocol refused — fall through to bytes */
        }
        const bytes = await invoke<number[]>('read_audio_file', {
          filePath: `${folderPath}${sep}audio.mp4`,
        });
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

  if (!folderPath) return null;

  return (
    <div className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-900">
        <MdMusicNote size={16} className="text-zinc-500" /> Recording
      </div>
      {src ? (
        <audio controls src={src} className="w-full" preload="metadata" />
      ) : error ? (
        <p className="text-[12.5px] text-zinc-500">
          No audio saved for this miting.
        </p>
      ) : (
        <p className="text-[12.5px] text-zinc-400">Loading…</p>
      )}
    </div>
  );
}

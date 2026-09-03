import React from 'react';
import { Upload } from 'lucide-react';
import { getAudioFormatsDisplayList } from '@/constants/audioFormats';

interface ImportDropOverlayProps {
  visible: boolean;
}

export function ImportDropOverlay({ visible }: ImportDropOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                 flex items-center justify-center pointer-events-none
                 transition-opacity duration-200"
    >
      <div className="mx-6 max-w-lg rounded-2xl border-2 border-dashed border-brand
                      bg-white/95 p-12 text-center shadow-2xl">
        <Upload className="mx-auto mb-4 h-14 w-14 text-brand" />
        <p className="text-lg font-semibold tracking-tight text-zinc-900">
          Drop audio file to import
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-500">
          {getAudioFormatsDisplayList()}
        </p>
      </div>
    </div>
  );
}

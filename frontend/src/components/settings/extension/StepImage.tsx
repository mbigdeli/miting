'use client';

import React, { useState } from 'react';
import { MdOutlineImage } from 'react-icons/md';

/**
 * Guide screenshot with a graceful placeholder: until the real PNG lands in
 * frontend/public/extension-guide/, a dashed drop-zone box renders instead of
 * a broken image.
 */
export function StepImage({ src, alt }: { src: string; alt: string }) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div className="flex h-[140px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400">
        <div className="flex flex-col items-center gap-1 text-center">
          <MdOutlineImage size={22} />
          <span className="text-[12px]">Screenshot coming soon</span>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export; no optimizer
    <img
      src={src}
      alt={alt}
      className="w-full rounded-lg border border-zinc-200"
      onError={() => setMissing(true)}
    />
  );
}

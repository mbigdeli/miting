'use client';

import React, { useState } from 'react';
import { GUIDE_VIDEO } from '@/lib/extensionGuide';

/**
 * Silent walkthrough recording shown above the step-by-step guide. Hides
 * itself entirely when the video asset is missing (dev checkouts), leaving
 * the static steps as the guide.
 */
export function GuideVideo() {
  const [missing, setMissing] = useState(false);

  if (missing) return null;

  return (
    <div>
      <h2 className="mb-3 text-[15px] font-semibold text-zinc-900">Watch the walkthrough</h2>
      <video
        src={GUIDE_VIDEO}
        controls
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full rounded-lg border border-zinc-200 bg-zinc-50"
        onError={() => setMissing(true)}
      />
    </div>
  );
}

'use client';

import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { InstallCard } from '@/components/settings/extension/InstallCard';
import { usePreparedExtension } from '@/components/settings/extension/usePreparedExtension';
import { PitchCard } from '@/components/settings/extension/PitchCard';
import { GuideSteps } from '@/components/settings/extension/GuideSteps';
import { GuideVideo } from '@/components/settings/extension/GuideVideo';

/**
 * Settings -> Chrome Extension. Opens with why the extension exists (it is an
 * optimisation for Google Meet, not a requirement), then the folder Chrome's
 * "Load unpacked" needs. The step-by-step walkthrough is collapsed: it is a
 * one-time read, and having it always open made this the longest tab in
 * Settings.
 */
export function ExtensionTab() {
  const { status, error, preparing, retry, reinstall } = usePreparedExtension();

  const copyPath = useCallback(async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      toast.success('Folder path copied — paste it in Chrome’s folder picker.');
    } catch {
      toast.error('Could not copy the path. Select and copy it manually.');
    }
  }, []);

  const install = useCallback(async () => {
    if (await reinstall()) toast.success('Extension files are ready.');
    else toast.error('Could not prepare the extension files.');
  }, [reinstall]);

  return (
    <div className="grid gap-4">
      <PitchCard />

      {!status && error ? (
        <div className="grid gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-[13px] text-red-700">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="justify-self-start rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-red-700 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : (
        <InstallCard
          status={status}
          busy={preparing}
          preparing={preparing}
          onInstall={install}
          onCopyPath={() => status && copyPath(status.installPath)}
        />
      )}

      <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3 [&[open]>summary]:mb-3">
        <summary className="cursor-pointer list-none text-[13.5px] font-medium text-zinc-900 marker:content-none">
          Show me how to add it to Chrome
        </summary>
        <GuideVideo />
        <div className="mt-4">
          <GuideSteps />
        </div>
      </details>
    </div>
  );
}

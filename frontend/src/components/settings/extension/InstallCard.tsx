'use client';

import React from 'react';
import { MdContentCopy, MdRefresh } from 'react-icons/md';
import { type ExtensionInstallStatus, installButtonLabel } from '@/lib/extensionGuide';

/**
 * The extension card: the folder Chrome's "Load unpacked" needs, and a way to
 * copy it. Everything else was noise — the version line said nothing a user
 * acts on, and neither shortcut button could do what it promised (Explorer
 * needs the real path, Chrome ignores chrome:// URLs from the command line).
 */
export function InstallCard({
  status,
  busy,
  preparing,
  onInstall,
  onCopyPath,
}: {
  status: ExtensionInstallStatus | null;
  busy: boolean;
  /** Copying the bundled files into place right now. */
  preparing: boolean;
  onInstall: () => void;
  onCopyPath: () => void;
}) {
  if (!status) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-zinc-400">Loading…</div>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-zinc-900">Miting Companion for Google Meet</div>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Point Chrome’s “Load unpacked” at this folder.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || status.bundledVersion === null}
          onClick={onInstall}
          title={`${installButtonLabel(status)}: re-copies the files this app ships into the folder below.`}
          aria-label={installButtonLabel(status)}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-40"
        >
          <MdRefresh size={16} className={busy ? 'animate-spin' : undefined} />
        </button>
      </div>

      {preparing ? (
        <p className="text-[12.5px] text-zinc-500">Preparing the extension files…</p>
      ) : status.installedVersion !== null ? (
        <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
          <code
            className="min-w-0 flex-1 truncate text-[12px] text-zinc-600"
            title={status.installPath}
          >
            {status.installPath}
          </code>
          <button
            type="button"
            onClick={onCopyPath}
            title="Copy the folder path"
            aria-label="Copy the folder path"
            className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-700"
          >
            <MdContentCopy size={14} />
          </button>
        </div>
      ) : (
        /* Never advertise a path Chrome would reject as empty. */
        <p className="text-[12.5px] text-amber-700">
          The extension files are not ready yet. Use the refresh button above to prepare them.
        </p>
      )}
    </div>
  );
}

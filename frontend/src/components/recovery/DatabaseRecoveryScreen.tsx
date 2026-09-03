'use client';

import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BackupPicker } from './BackupPicker';
import { useDatabaseRecovery } from './useDatabaseRecovery';

interface DatabaseRecoveryScreenProps {
  error: string;
}

/**
 * Shown instead of the app when startup could not open the meetings database.
 * The window still opens (that is the point) and this is the only surface the
 * user gets, so it has to explain the failure and offer both repair paths.
 */
export function DatabaseRecoveryScreen({ error }: DatabaseRecoveryScreenProps) {
  const { backups, busy, actionError, restore, startFresh, openDataFolder } = useDatabaseRecovery();
  const [confirmingFresh, setConfirmingFresh] = useState(false);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-50 font-inter text-zinc-950">
      <div className="mx-auto flex min-h-full w-full max-w-[620px] flex-col justify-center px-8 py-14">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.5px]">
          Miting could not open your meetings database
        </h1>
        <p className="mt-2 text-[15px] text-zinc-500">
          Your recordings and audio files are untouched — only the database that indexes them
          failed to open. Pick a recovery option below.
        </p>

        <Alert variant="destructive" className="mt-6 bg-white">
          <AlertTitle>Error details</AlertTitle>
          <AlertDescription className="break-words font-mono text-[12px]">{error}</AlertDescription>
        </Alert>

        <section className="mt-8">
          <h2 className="text-[15px] font-semibold">Restore an automatic backup</h2>
          <p className="mt-1 text-[13px] text-zinc-500">
            Miting snapshots the database before applying updates. Restoring returns you to that
            point in time; anything recorded afterwards is not in the snapshot.
          </p>
          <BackupPicker backups={backups} disabled={busy !== null} onRestore={restore} />
        </section>

        <section className="mt-8">
          <h2 className="text-[15px] font-semibold">Start with an empty database</h2>
          <p className="mt-1 text-[13px] text-zinc-500">
            The unreadable file is kept next to the new one so it can be rescued later. Past
            meetings disappear from the app until then.
          </p>
          {confirmingFresh ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={startFresh}
                className="rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {busy === 'fresh' ? 'Starting fresh…' : 'Yes, start fresh'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingFresh(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-[13px] font-medium"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setConfirmingFresh(true)}
              className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-[13px] font-medium disabled:opacity-50"
            >
              Start fresh
            </button>
          )}
        </section>

        {actionError && (
          <Alert variant="destructive" className="mt-6 bg-white">
            <AlertTitle>That did not work</AlertTitle>
            <AlertDescription className="break-words font-mono text-[12px]">
              {actionError}
            </AlertDescription>
          </Alert>
        )}

        <button
          type="button"
          onClick={openDataFolder}
          className="mt-8 self-start text-[13px] font-medium text-zinc-600 underline"
        >
          Open the data folder
        </button>
      </div>
    </div>
  );
}

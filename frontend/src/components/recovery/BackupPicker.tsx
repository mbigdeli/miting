'use client';

import React from 'react';
import {
  formatBackupSize,
  formatBackupWhen,
  sortBackupsNewestFirst,
  type DatabaseBackup,
} from '@/lib/databaseRecovery';

interface BackupPickerProps {
  backups: DatabaseBackup[];
  disabled: boolean;
  onRestore: (fileName: string) => void;
}

/**
 * Snapshots are only written when a migration is pending, so a database that
 * breaks for other reasons can legitimately have none — say so rather than
 * showing an empty list.
 */
export function BackupPicker({ backups, disabled, onRestore }: BackupPickerProps) {
  if (backups.length === 0) {
    return (
      <p className="mt-3 text-[13px] text-zinc-500">
        No automatic backups were found. Your meetings may still be recoverable from the data
        folder — starting fresh keeps the existing file rather than deleting it.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {sortBackupsNewestFirst(backups).map((backup) => (
        <li
          key={backup.fileName}
          className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-zinc-900">
              {formatBackupWhen(backup.modifiedSecs)}
            </p>
            <p className="text-[12px] text-zinc-500">{formatBackupSize(backup.sizeBytes)}</p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRestore(backup.fileName)}
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            Restore this
          </button>
        </li>
      ))}
    </ul>
  );
}

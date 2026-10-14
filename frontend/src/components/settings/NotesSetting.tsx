'use client';

import { saveNotesEnabled, useNotesEnabled } from '@/lib/notes/enabled';
import { RowText, SettingRow, Toggle } from './primitives';

/** Settings > Summary: the switch for notes and Ask AI (doc 20). */
export function NotesSetting() {
  const enabled = useNotesEnabled();
  return (
    <SettingRow>
      <RowText
        title="Notes and Ask AI"
        desc="Take notes during and after a miting, and ask the AI about it. Your notes shape the summary."
      />
      <Toggle checked={enabled} onChange={saveNotesEnabled} label="Notes and Ask AI" />
    </SettingRow>
  );
}

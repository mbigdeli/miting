-- Acoustic speaker identification (doc 18): one row per voice the local
-- diarizer found in a meeting. `name` always equals the speaker_name used by
-- that voice's rows in meeting_diarized_segments, so renames update both.
-- Meetings diarized from Google Meet captions have no rows here; their names
-- come straight from Meet.
CREATE TABLE IF NOT EXISTS meeting_speakers (
    meeting_id TEXT NOT NULL,
    -- Stable label from the diarizer ("Speaker 1"); never shown once renamed.
    label TEXT NOT NULL,
    -- Current display name.
    name TEXT NOT NULL,
    -- Who chose the name: 'auto' (Speaker N), 'ai' (suggested from the
    -- transcript, awaiting confirmation) or 'user'.
    name_source TEXT NOT NULL DEFAULT 'auto',
    -- Transcript quote the AI relied on, shown so the user can judge it.
    ai_evidence TEXT,
    speech_secs REAL NOT NULL DEFAULT 0,
    -- A clean stretch of this voice for the "Listen" button.
    sample_start_sec REAL,
    sample_end_sec REAL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (meeting_id, label),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

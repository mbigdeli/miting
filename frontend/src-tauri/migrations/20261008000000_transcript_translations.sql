-- Translations of transcript lines (live translation during recording, and
-- on-demand translation of saved mitings). One row per line per language, so a
-- miting can hold any number of languages side by side.
--
-- segment_key points at the line that was translated:
--   * transcripts.id                  for the plain transcript
--   * 'diarized-' || seq              for meeting_diarized_segments rows
-- It is deliberately not a foreign key (two source tables); rows whose line no
-- longer exists are simply never matched when reading.
CREATE TABLE IF NOT EXISTS transcript_translations (
    meeting_id TEXT NOT NULL,
    segment_key TEXT NOT NULL,
    language TEXT NOT NULL,
    text TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (meeting_id, segment_key, language),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transcript_translations_meeting_language
    ON transcript_translations(meeting_id, language);

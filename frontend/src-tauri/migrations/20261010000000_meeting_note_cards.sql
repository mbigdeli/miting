-- Notes the user writes on a miting: during recording (pinned to the moment
-- they were written, or to transcript text they selected) or afterwards.
-- One row per note card, so each card can be edited or deleted on its own.
--
-- at_sec      recording clock in seconds (pauses excluded), the same clock as
--             transcripts.audio_start_time; NULL for a note with no moment.
-- quotes_json [{"quote": "...", "at": 12.5}] transcript text the note is about.
-- source      'user' typed it; 'ask' it is an Ask AI answer the user saved.
CREATE TABLE IF NOT EXISTS meeting_note_cards (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    at_sec REAL,
    body_html TEXT NOT NULL,
    quotes_json TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'user',
    edited INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_note_cards_meeting
    ON meeting_note_cards(meeting_id);

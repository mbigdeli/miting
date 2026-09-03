-- Which Meet a gmeet session belongs to, straight from the extension at
-- session_start. Until now the URL was thrown away, so a saved meeting could
-- not say which Google Meet call it came from.
CREATE TABLE IF NOT EXISTS gmeet_session_meta (
    gmeet_session_id TEXT PRIMARY KEY,
    meeting_code TEXT NOT NULL,
    meeting_url TEXT,
    created_at TEXT NOT NULL
);

-- Copied from gmeet_session_meta when the meeting is finalized; NULL for
-- local (non-Meet) recordings.
ALTER TABLE meetings ADD COLUMN meet_url TEXT;

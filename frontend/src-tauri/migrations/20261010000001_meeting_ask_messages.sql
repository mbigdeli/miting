-- Questions the user asked the AI about a miting, with the answers. One
-- conversation per miting: it starts during recording and continues after.
--
-- asked_at_sec   recording clock when asked live; NULL when asked afterwards.
-- quotes_json    [{"quote": "...", "at": 12.5}] transcript text the user
--                selected for the question.
-- citations_json [12.5, 66.0] start seconds of the transcript lines the answer
--                cites, checked against the transcript before saving.
-- saved_note_id  the note card the answer was saved as, if any.
CREATE TABLE IF NOT EXISTS meeting_ask_messages (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL,
    asked_at_sec REAL,
    question TEXT NOT NULL,
    quotes_json TEXT NOT NULL DEFAULT '[]',
    answer_md TEXT,
    citations_json TEXT NOT NULL DEFAULT '[]',
    error TEXT,
    provider TEXT,
    model TEXT,
    saved_note_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_ask_messages_meeting
    ON meeting_ask_messages(meeting_id, created_at);

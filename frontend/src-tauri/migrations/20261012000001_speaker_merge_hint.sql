-- AI suggestion that a voice is the same person as another (doc 18, review).
-- ai_merge_into holds the other voice's label; the user merges or dismisses.
ALTER TABLE meeting_speakers ADD COLUMN ai_merge_into TEXT;
ALTER TABLE meeting_speakers ADD COLUMN ai_merge_evidence TEXT;

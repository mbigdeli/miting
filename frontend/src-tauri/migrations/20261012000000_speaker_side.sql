-- Where each acoustic speaker was heard (doc 18, channel split): 'room'
-- (the microphone) or 'remote' (the call, via system audio). NULL for
-- recordings made before the channel log existed and for imports.
ALTER TABLE meeting_speakers ADD COLUMN side TEXT;

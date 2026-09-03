-- Record which transcription engine + model produced each meeting's
-- transcript, stamped at save time. The details page previously echoed the
-- CURRENT config labelled "Whisper", which misattributed meetings made with
-- Shenava/Parakeet or before an engine switch. Additive-only; NULL for
-- meetings that predate this migration (shown as unknown in the UI).
ALTER TABLE meetings ADD COLUMN transcription_engine TEXT;
ALTER TABLE meetings ADD COLUMN transcription_model TEXT;

-- Per-block caption identity.
--
-- Meet renders each utterance as its own DOM block and keeps REVISING earlier
-- blocks while later ones grow. The extension now mirrors every visible block
-- by a per-session sequence number, so a caption row is addressed exactly —
-- no more guessing from text prefixes which row an update belongs to.
-- Legacy rows (and old extensions) leave block_seq NULL, which the unique
-- index treats as distinct, so nothing existing conflicts.
ALTER TABLE gmeet_captions ADD COLUMN block_seq INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gmeet_captions_session_block
  ON gmeet_captions (gmeet_session_id, block_seq);

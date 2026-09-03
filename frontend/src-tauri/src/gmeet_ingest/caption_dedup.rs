//! Collapse Google Meet's cumulative captions into one row per utterance.
//!
//! Meet re-sends a live utterance as it grows — "Let's see", "Let's see it",
//! "Let's see it can record" — so inserting every arrival turned a single
//! sentence into a column of near-duplicate rows, which is what the saved
//! transcripts looked like. Only the longest form of a growing utterance is
//! worth keeping.

/// What to do with an incoming caption, given the row stored before it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CaptionWrite {
    /// Nothing stored yet for this utterance, or a new one began.
    Insert,
    /// The same utterance, now longer: overwrite the previous row.
    ReplacePrevious,
    /// Same or shorter than what is stored — Meet re-sent a stale frame.
    Skip,
}

/// Normalise for comparison: Meet varies trailing punctuation and spacing
/// between frames of the same utterance.
fn normalize(text: &str) -> String {
    text.trim()
        .trim_end_matches(['.', ',', '!', '?', '…'])
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Decide how to store `incoming` given `previous` (the last row for the same
/// speaker in this session), if any.
pub fn classify(previous: Option<&str>, incoming: &str) -> CaptionWrite {
    let Some(previous) = previous else {
        return CaptionWrite::Insert;
    };
    let (prev, next) = (normalize(previous), normalize(incoming));
    if next == prev {
        return CaptionWrite::Skip;
    }
    // Meet only ever appends within an utterance, so a prefix match identifies
    // the same one still growing.
    if next.starts_with(&prev) {
        return CaptionWrite::ReplacePrevious;
    }
    if prev.starts_with(&next) {
        // A late, shorter frame of an utterance already stored in full.
        return CaptionWrite::Skip;
    }
    // Meet also REVISES the tail of a live utterance ("…کنم سخت باشه" becomes
    // "…کنم ضبط رو زدم"), so strict prefixing alone split one sentence into a
    // new row on every revision — the duplicate column the live view showed.
    // The extension's consolidator has always used this dominant-common-prefix
    // rule; the two ends of the pipe must agree on what "the same turn" is.
    if shares_dominant_prefix(&prev, &next) {
        return CaptionWrite::ReplacePrevious;
    }
    if is_tail_revision(&prev, &next) {
        return CaptionWrite::ReplacePrevious;
    }
    CaptionWrite::Insert
}

/// The live utterance with its unstable last word revised.
///
/// ASR keeps rewriting the newest word as more audio arrives — «این باز حالا»
/// becomes «این بازی حالا الان» — and by then the shared prefix is well under
/// 80% of either string, so the ratio rule reads it as a new sentence. The
/// stable part IS everything before that last word: if it prefixes the
/// incoming text, this is the same utterance still growing. Two words and six
/// chars of stable head are required so two sentences that merely open with
/// the same word («الان …» / «الان …») are not glued together.
fn is_tail_revision(prev: &str, next: &str) -> bool {
    let words: Vec<&str> = prev.split_whitespace().collect();
    if words.len() < 3 {
        return false;
    }
    let stable = words[..words.len() - 1].join(" ");
    stable.chars().count() >= 6 && next.starts_with(&stable) && next.len() > stable.len()
}

/// Same rule as the extension's `isSameTurn`: a common prefix covering at
/// least 80% of the shorter string (and at least 6 chars) is one utterance.
///
/// The floor was 8 and Persian ASR flaps short fragments right under it —
/// «این بازی» against «این باز حالا» share exactly 7 chars, so every flap
/// opened a new row and one spoken turn saved as four. It cannot drop to 4
/// either: «الان چی» against «الان بریم…» share 5, and gluing those merges two
/// sentences that merely open with the same word. Six admits the first and
/// refuses the second; is_tail_revision below covers the longer flaps the
/// ratio can never reach.
fn shares_dominant_prefix(a: &str, b: &str) -> bool {
    let (a, b): (Vec<char>, Vec<char>) = (a.chars().collect(), b.chars().collect());
    let min = a.len().min(b.len());
    if min == 0 {
        return false;
    }
    let mut i = 0;
    while i < min && a[i] == b[i] {
        i += 1;
    }
    i >= 6.max(min * 4 / 5)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_first_caption_is_stored() {
        assert_eq!(classify(None, "Let's see"), CaptionWrite::Insert);
    }

    #[test]
    fn a_growing_utterance_replaces_its_own_previous_frame() {
        assert_eq!(
            classify(Some("Let's see"), "Let's see it can record"),
            CaptionWrite::ReplacePrevious,
        );
    }

    #[test]
    fn an_identical_resend_is_dropped() {
        assert_eq!(classify(Some("Let's see"), "Let's see"), CaptionWrite::Skip);
    }

    #[test]
    fn punctuation_and_spacing_do_not_make_a_new_utterance() {
        assert_eq!(
            classify(Some("Let's see it."), "let's  see it"),
            CaptionWrite::Skip,
        );
    }

    #[test]
    fn a_late_shorter_frame_does_not_truncate_what_is_stored() {
        assert_eq!(
            classify(Some("Let's see it can record"), "Let's see it"),
            CaptionWrite::Skip,
        );
    }

    #[test]
    fn a_genuinely_new_sentence_is_inserted() {
        assert_eq!(
            classify(Some("Let's see it can record"), "Okay, next topic"),
            CaptionWrite::Insert,
        );
    }

    #[test]
    fn a_repeated_phrase_later_in_the_call_is_kept() {
        // "Yeah" after a different sentence is a real second utterance.
        assert_eq!(classify(Some("Okay then"), "Yeah"), CaptionWrite::Insert);
    }

    #[test]
    fn a_tail_revision_rewrites_the_same_row() {
        // The duplicate-column bug: Meet revised the trailing words of a live
        // Persian utterance and strict prefixing called it a new sentence.
        assert_eq!(
            classify(
                Some("خب الان آیا میتونی چیز بکنی ضبط بکنی این تیکش کنم سخت باشه"),
                "خب الان آیا میتونی چیز بکنی ضبط بکنی این تیکش کنم ضبط رو زدم و صدا",
            ),
            CaptionWrite::ReplacePrevious
        );
    }

    #[test]
    fn a_genuinely_new_sentence_still_inserts() {
        assert_eq!(
            classify(Some("سلام چطوری خوبی"), "من خوبم ممنون تو چطوری"),
            CaptionWrite::Insert
        );
    }

    #[test]
    fn a_short_persian_flap_stays_one_row() {
        // Saved four rows for one spoken turn: the old 8-char floor sat just
        // above the 7 chars these share.
        assert_eq!(
            classify(Some("این بازی"), "این باز حالا"),
            CaptionWrite::ReplacePrevious
        );
        assert_eq!(
            classify(Some("این باز حالا"), "این بازی حالا الان"),
            CaptionWrite::ReplacePrevious
        );
    }

    #[test]
    fn two_sentences_that_merely_start_alike_stay_separate() {
        assert_eq!(
            classify(Some("الان میرم خونه"), "الان بیا اینجا ببین"),
            CaptionWrite::Insert
        );
    }

    #[test]
    fn sentences_opening_with_the_same_word_are_not_glued() {
        assert_eq!(
            classify(Some("الان چی"), "الان بریم سراغ بعدی"),
            CaptionWrite::Insert
        );
    }
}

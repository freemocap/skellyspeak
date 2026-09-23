use super::*;

fn kinds(comparison: &DrillComparison) -> Vec<(WordOutcome, Option<&str>, Option<&str>)> {
    comparison
        .words
        .iter()
        .map(|word| {
            (
                word.kind,
                word.target.as_deref(),
                word.transcript.as_deref(),
            )
        })
        .collect()
}

#[test]
fn an_exact_repeat_measures_no_error_and_says_what_it_normalized() {
    let exact = compare("Quisiera un café.", "quisiera un café.");
    assert_eq!(exact.edits, 0);
    assert_eq!(exact.character_error_rate, Some(0.0));
    assert_eq!(exact.match_ratio, Some(1.0));
    assert_eq!(exact.policy, POLICY);
    // The attempt matched only after case folding, and the result says so.
    assert!(exact.normalizations.contains(&"lowercase".to_string()));
    assert!(
        exact
            .words
            .iter()
            .all(|word| word.kind == WordOutcome::Same)
    );
    // The originals are kept exactly as they were spoken and written.
    assert_eq!(exact.target, "Quisiera un café.");
    assert_eq!(exact.transcript, "quisiera un café.");
}

#[test]
fn diacritics_are_compared_not_folded_away() {
    // A match must never claim a distinction it did not measure.
    let dropped = compare("café", "cafe");
    assert_eq!(dropped.edits, 1);
    assert_eq!(dropped.character_error_rate, Some(0.25));
    assert!(
        !dropped
            .normalizations
            .iter()
            .any(|step| step.contains("diacritic"))
    );
    // Decomposed and composed spellings of the same word are the same word.
    let decomposed = compare("café", "cafe\u{301}");
    assert_eq!(decomposed.edits, 0);
    assert!(
        decomposed
            .normalizations
            .contains(&"unicode_nfc".to_string())
    );
}

#[test]
fn a_grapheme_is_counted_the_way_a_reader_counts_it() {
    // Three graphemes, not the six scalars Devanagari needs to write them.
    let comparison = compare("नमस्ते", "नमस्ते");
    assert_eq!(comparison.edits, 0);
    assert_eq!(comparison.reference_graphemes, 3);
    let flag = compare("🇪🇸", "🇫🇷");
    assert_eq!(flag.reference_graphemes, 1);
    assert_eq!(flag.edits, 1);
    assert_eq!(flag.character_error_rate, Some(1.0));
}

#[test]
fn every_word_outcome_is_named_and_a_near_miss_stays_one_word() {
    let comparison = compare(
        "quiero un café con leche",
        "quiero dos café rápido con leche",
    );
    assert_eq!(
        kinds(&comparison),
        vec![
            (WordOutcome::Same, Some("quiero"), Some("quiero")),
            (WordOutcome::Substituted, Some("un"), Some("dos")),
            (WordOutcome::Same, Some("café"), Some("café")),
            (WordOutcome::Extra, None, Some("rápido")),
            (WordOutcome::Same, Some("con"), Some("con")),
            (WordOutcome::Same, Some("leche"), Some("leche")),
        ]
    );
    // A dropped word is missing, not a substitution of its neighbour.
    let dropped = compare("quiero un café", "quiero café");
    assert_eq!(
        kinds(&dropped),
        vec![
            (WordOutcome::Same, Some("quiero"), Some("quiero")),
            (WordOutcome::Missing, Some("un"), None),
            (WordOutcome::Same, Some("café"), Some("café")),
        ]
    );
    // A near miss reads as one changed word, with how close it was.
    let near = compare("hablo español", "hablo espanol");
    assert_eq!(near.words[1].kind, WordOutcome::Substituted);
    let similarity = near.words[1].similarity.unwrap();
    assert!(similarity > 0.8 && similarity < 1.0, "{similarity}");
}

#[test]
fn right_to_left_and_cjk_texts_align_by_their_own_words() {
    let arabic = compare("أحب القراءة كثيرا", "أحب القراءة");
    assert_eq!(
        kinds(&arabic),
        vec![
            (WordOutcome::Same, Some("أحب"), Some("أحب")),
            (WordOutcome::Same, Some("القراءة"), Some("القراءة")),
            (WordOutcome::Missing, Some("كثيرا"), None),
        ]
    );
    assert_eq!(arabic.script_note, ScriptNote::Matches);
    // Mandarin writes without spaces, so it is one word to the aligner and the
    // character rate carries the measurement.
    let mandarin = compare("我喜欢看书", "我喜欢喝茶");
    assert_eq!(mandarin.words.len(), 1);
    assert_eq!(mandarin.words[0].kind, WordOutcome::Substituted);
    assert_eq!(mandarin.edits, 2);
    assert_eq!(mandarin.reference_graphemes, 5);
}

#[test]
fn an_empty_side_is_reported_rather_than_scored_as_a_match() {
    // Nothing said: a real zero, measured against the target.
    let silent = compare("quiero café", "");
    assert_eq!(silent.edits, silent.reference_graphemes);
    assert_eq!(silent.character_error_rate, Some(1.0));
    assert_eq!(silent.match_ratio, Some(0.0));
    assert!(
        silent
            .words
            .iter()
            .all(|word| word.kind == WordOutcome::Missing)
    );
    // Nothing to say: unmeasurable, not a perfect score.
    let empty_target = compare("", "quiero café");
    assert_eq!(empty_target.character_error_rate, None);
    assert_eq!(empty_target.match_ratio, None);
    assert_eq!(empty_target.reference_graphemes, 0);
    assert!(
        empty_target
            .words
            .iter()
            .all(|word| word.kind == WordOutcome::Extra)
    );
}

#[test]
fn a_different_script_is_an_advisory_note_and_changes_no_number() {
    let latin = compare("我喜欢看书", "wo xi huan kan shu");
    assert_eq!(latin.script_note, ScriptNote::Mismatch);
    // The note is beside the measurement, never instead of it.
    assert_eq!(latin.reference_graphemes, 5);
    assert!(latin.character_error_rate.is_some());
    // Digits and punctuation carry no script, so nothing is claimed.
    assert_eq!(compare("123", "123").script_note, ScriptNote::Unknown);
}

#[test]
fn the_same_pair_always_compares_the_same_way() {
    let first = compare("quiero un café con leche", "quiero dos cafes con leche");
    for _ in 0..5 {
        assert_eq!(
            compare("quiero un café con leche", "quiero dos cafes con leche"),
            first
        );
    }
    // What is stored is what was measured.
    let stored: serde_json::Value = serde_json::from_str(&record(&first).unwrap()).unwrap();
    assert_eq!(stored["policy"], POLICY);
    assert_eq!(stored["edits"], first.edits as u64);
    assert_eq!(stored["words"][1]["kind"], "substituted");
}

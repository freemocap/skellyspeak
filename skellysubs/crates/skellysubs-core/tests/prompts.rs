//! Golden tests for the three translation prompts: exact template content and
//! placeholder filling.

use skellysubs_core::models::{LanguageBackground, LanguageConfig};
use skellysubs_core::translation::{
    full_text_prompt, segment_level_prompt, word_level_prompt,
    FULL_TEXT_TRANSLATION_SYSTEM_PROMPT, SEGMENT_LEVEL_TRANSCRIPT_TRANSLATION_SYSTEM_PROMPT,
    WORD_LEVEL_TRANSLATION_MATCHING_TASK_INSTRUCTIONS,
};

fn english() -> LanguageConfig {
    LanguageConfig {
        language_name: "English".into(),
        language_code: "en".into(),
        romanization_method: None,
        background: LanguageBackground {
            family_tree: vec!["Indo-European".into(), "Germanic".into()],
            alphabet: "Latin".into(),
            sample_text: "The quick brown fox".into(),
            sample_romanized_text: None,
            wikipedia_links: vec![],
        },
    }
}

fn assert_no_placeholders(s: &str, keys: &[&str]) {
    for k in keys {
        assert!(
            !s.contains(&format!("{{{k}}}")),
            "leftover placeholder {k} in: {s}"
        );
    }
}

#[test]
fn prompts_contain_key_instructions() {
    assert!(FULL_TEXT_TRANSLATION_SYSTEM_PROMPT.contains("ORIGINAL LANGUAGE TRANSCRIPT"));
    assert!(SEGMENT_LEVEL_TRANSCRIPT_TRANSLATION_SYSTEM_PROMPT.contains("SECTION OF ORIGINAL TEXT TO TRANSLATE"));
    assert!(WORD_LEVEL_TRANSLATION_MATCHING_TASK_INSTRUCTIONS.contains("covers multiple words"));
    assert!(WORD_LEVEL_TRANSLATION_MATCHING_TASK_INSTRUCTIONS.contains("indexed list of words"));
}

#[test]
fn full_text_prompt_fills() {
    let p = full_text_prompt("English", &english(), "Hello world");
    assert_no_placeholders(
        &p,
        &[
            "original_language",
            "target_language_with_their_romanization_methods",
            "original_language_transcript",
        ],
    );
    assert!(p.contains("English"));
    assert!(p.contains("Hello world"));
}

#[test]
fn segment_level_prompt_fills() {
    let p = segment_level_prompt("English", &english(), "Hello world", 0, 3, "Hello", 0.0, 1.5, 3.0);
    assert_no_placeholders(
        &p,
        &[
            "original_language",
            "target_language_with_their_romanization_methods",
            "full_transcription_text_in_original_language",
            "segment_number",
            "total_segments",
            "current_segment_in_original_language",
            "start_timestamp",
            "end_timestamp",
            "duration",
        ],
    );
    assert!(p.contains("Section# 0 of 3"));
}

#[test]
fn word_level_prompt_fills() {
    let p = word_level_prompt("English", &english(), "([0]Hello)", "([0]Hola)");
    assert_no_placeholders(
        &p,
        &[
            "original_language",
            "target_language_with_their_romanization_methods",
            "current_segment_in_original_language_including_indexed_words_and_timestamps",
            "indexed_list_of_available_words_in_target_languages",
        ],
    );
    assert!(p.contains("([0]Hello)"));
    assert!(p.contains("([0]Hola)"));
}

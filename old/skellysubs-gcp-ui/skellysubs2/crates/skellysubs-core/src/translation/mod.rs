//! Translation pipeline: the three prompts plus the word-indexing helpers
//! that format segment words for the LLM.

pub mod prompts;

use crate::models::WordTimestamp;

pub use prompts::{
    full_text_prompt, segment_level_prompt, word_level_prompt,
    FULL_TEXT_TRANSLATION_SYSTEM_PROMPT, SEGMENT_LEVEL_TRANSCRIPT_TRANSLATION_SYSTEM_PROMPT,
    WORD_LEVEL_TRANSLATION_MATCHING_TASK_INSTRUCTIONS,
};

/// Format original-language words as `([index]word [starting_timestamp: ...,
/// ending_timestamp: ...])` — the input the word-matching prompt expects for
/// the original segment.
pub fn indexed_original_words_with_timestamps(words: &[WordTimestamp]) -> String {
    words
        .iter()
        .enumerate()
        .map(|(index, w)| {
            format!(
                " ([orginal-language-index-{index}]{word} [starting_timestamp: {start:.2}, ending_timestamp: {end:.2}])
",
                word = w.text,
                start = w.start_ms as f64 / 1000.0,
                end = w.end_ms as f64 / 1000.0,
            )
        })
        .collect::<String>()
}

/// Format target-language words as `([translated-language-index-{i}]word)`.
pub fn indexed_target_words(words: &[String]) -> String {
    words
        .iter()
        .enumerate()
        .map(|(index, word)| format!("([translated-language-index-{index}]{word})"))
        .collect::<Vec<_>>()
        .join("
")
}

/// Split a target-language text into a word list. English/latin splits on
/// whitespace; CJK needs a segmenter (TODO: `lindera`/`icu-segmenter`, or
/// rely on the LLM's `translated_words_list` which is already tokenized).
pub fn split_words(text: &str) -> Vec<String> {
    text.split_whitespace().map(str::to_string).collect()
}

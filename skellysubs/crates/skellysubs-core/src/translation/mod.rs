//! Translation pipeline: the three prompts plus word-indexing helpers.

pub mod pipeline;
pub mod prompts;

use crate::models::WordTimestamp;

pub use prompts::{
    full_text_prompt, segment_level_prompt, word_level_prompt,
    FULL_TEXT_TRANSLATION_SYSTEM_PROMPT, SEGMENT_LEVEL_TRANSCRIPT_TRANSLATION_SYSTEM_PROMPT,
    WORD_LEVEL_TRANSLATION_MATCHING_TASK_INSTRUCTIONS,
};

/// Format original-language words as ([index]word [starting_timestamp: ...,
/// ending_timestamp: ...]) — the input the word-matching prompt expects.
pub fn indexed_original_words_with_timestamps(words: &[WordTimestamp]) -> String {
    words
        .iter()
        .enumerate()
        .map(|(index, w)| {
            format!(
                " ([orginal-language-index-{index}]{word} [starting_timestamp: {start:.2}, ending_timestamp: {end:.2}])\n",
                word = w.text,
                start = w.start_ms as f64 / 1000.0,
                end = w.end_ms as f64 / 1000.0,
            )
        })
        .collect::<String>()
}

/// Format target-language words as ([translated-language-index-{i}]word),
/// stripping punctuation first so the LLM matches clean words.
pub fn indexed_target_words(words: &[String]) -> String {
    words
        .iter()
        .enumerate()
        .map(|(index, word)| {
            let clean = strip_punctuation_and_whitespace(word);
            format!("([translated-language-index-{index}]{clean})")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Remove punctuation (ASCII + common foreign scripts) and surrounding
/// whitespace. Mirrors the original python-only helper.
pub fn strip_punctuation_and_whitespace(text: &str) -> String {
    const NON_ASCII_PUNCT: &str = "，。、？！：；（）《》【】「」『』・〜·،؛؟;—«»–‐…′″।՝։ฯๆ";
    text.trim()
        .chars()
        .filter(|c| !c.is_ascii_punctuation() && !NON_ASCII_PUNCT.contains(*c))
        .collect()
}

/// Split a target-language text into a word list (latin splits on whitespace).
pub fn split_words(text: &str) -> Vec<String> {
    text.split_whitespace().map(str::to_string).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(start: i64, end: i64, text: &str, idx: i32) -> WordTimestamp {
        WordTimestamp {
            start_ms: start,
            end_ms: end,
            text: text.into(),
            index_in_segment: idx,
            index_in_transcript: idx,
        }
    }

    #[test]
    fn indexes_original_words_with_timestamps() {
        let words = vec![word(0, 500, "Hello", 0), word(600, 900, "world", 1)];
        let out = indexed_original_words_with_timestamps(&words);
        assert!(out.contains("([orginal-language-index-0]Hello [starting_timestamp: 0.00, ending_timestamp: 0.50])"));
        assert!(out.contains("([orginal-language-index-1]world [starting_timestamp: 0.60, ending_timestamp: 0.90])"));
    }

    #[test]
    fn indexes_target_words_strips_punctuation() {
        let out = indexed_target_words(&["Hola,".to_string(), "mundo.".to_string()]);
        assert!(out.contains("([translated-language-index-0]Hola)"));
        assert!(out.contains("([translated-language-index-1]mundo)"));
    }

    #[test]
    fn strips_punctuation_and_whitespace() {
        assert_eq!(strip_punctuation_and_whitespace("Hello, world!"), "Hello world");
        assert_eq!(strip_punctuation_and_whitespace("مرحبا،"), "مرحبا");
        assert_eq!(strip_punctuation_and_whitespace("你好，世界！"), "你好世界");
    }

    #[test]
    fn splits_whitespace() {
        assert_eq!(split_words("Hello world"), vec!["Hello", "world"]);
    }
}

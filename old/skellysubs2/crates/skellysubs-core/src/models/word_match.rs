//! Word-level alignment types — the signature feature.
//!
//! `MatchedTranslatedSegment` / `MatchedTranslatedWord` are the LLM's
//! structured response for the word-matching prompt: for every original word,
//! the closest matching target-language word (allowing many-to-one).

use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

use super::serde::opt_none_string;

/// One original word aligned to one target-language word.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct MatchedTranslatedWord {
    #[schemars(description = "The start time of the period in the segment when the word was spoken, in seconds since the start of the recording.")]
    pub start_time: f64,
    #[schemars(description = "The end time of the period in the recording when the word was spoken, in seconds since the start of the recording.")]
    pub end_time: f64,
    #[schemars(description = "The original word from the original segment.")]
    pub original_word_text: String,
    #[schemars(description = "The index of the original word in the original segment.")]
    pub original_word_index: i32,
    #[schemars(description = "The translated word from the target language translation that matches the original word.")]
    pub translated_word_text: String,
    #[serde(default, deserialize_with = "opt_none_string")]
    #[schemars(description = "For non-Latin target scripts, the romanized form of the translated word.")]
    pub translated_word_romanized_text: Option<String>,
    #[schemars(description = "The index of the translated word in the translated segment that matches this original word.")]
    pub translated_word_index: i32,
}

/// A segment's complete word-level alignment into one target language.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct MatchedTranslatedSegment {
    #[schemars(description = "The start time of the segment, in seconds since the start of the recording.")]
    pub start: f64,
    #[schemars(description = "The end time of the segment, in seconds since the start of the recording.")]
    pub end: f64,
    #[schemars(description = "The original text of the segment in its original language.")]
    pub original_segment_text: String,
    #[schemars(description = "The translated text of the segment in the target language.")]
    pub translated_segment_text: String,
    #[serde(default, deserialize_with = "opt_none_string")]
    #[schemars(description = "The romanized version of the translated segment text, if applicable.")]
    pub romanized_translated_text: Option<String>,
    #[schemars(description = "The original words in the segment; the list index matches the word's index in the segment string.")]
    pub original_words_list: Vec<String>,
    #[schemars(description = "The words/characters in the translated segment that match the original words; may differ in length from original_words_list.")]
    pub translated_words_list: Vec<String>,
    #[serde(default)]
    #[schemars(description = "The romanized versions of the translated words, if applicable; same length as translated_words_list.")]
    pub romanized_translated_words_list: Option<Vec<String>>,
    #[schemars(description = "The translated words in the segment, with their romanizations if applicable; same length as original_words_list.")]
    pub matched_translated_words: Vec<MatchedTranslatedWord>,
}

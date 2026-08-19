//! Word-level alignment types, the signature feature.

use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

use super::serde::opt_none_string;

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

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> MatchedTranslatedSegment {
        MatchedTranslatedSegment {
            start: 0.0,
            end: 1.0,
            original_segment_text: "hello".into(),
            translated_segment_text: "hola".into(),
            romanized_translated_text: None,
            original_words_list: vec!["hello".into()],
            translated_words_list: vec!["hola".into()],
            romanized_translated_words_list: None,
            matched_translated_words: vec![MatchedTranslatedWord {
                start_time: 0.0,
                end_time: 0.5,
                original_word_text: "hello".into(),
                original_word_index: 0,
                translated_word_text: "hola".into(),
                translated_word_romanized_text: None,
                translated_word_index: 0,
            }],
        }
    }

    #[test]
    fn schema_requires_core_fields() {
        let schema = schemars::schema_for!(MatchedTranslatedSegment);
        let v = serde_json::to_value(schema).unwrap();
        assert!(v["properties"]["matched_translated_words"].is_object());
        let required = v["required"].as_array().unwrap();
        assert!(required.iter().any(|r| r == "matched_translated_words"));
        assert!(required.iter().any(|r| r == "original_words_list"));
    }

    #[test]
    fn round_trips() {
        let s = serde_json::to_string(&sample()).unwrap();
        let rt: MatchedTranslatedSegment = serde_json::from_str(&s).unwrap();
        assert_eq!(rt, sample());
    }
}

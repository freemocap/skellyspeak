//! The per-utterance translation + word-matching orchestrator.
//!
//! Reuses the three python-only prompts verbatim, in order:
//!   1. full-text translation
//!   2. segment-level translation (with full-text context)
//!   3. word-level matching (many-to-one alignment)

use crate::llm::AiClient;
use crate::models::{LanguageConfig, MatchedTranslatedSegment, TranslatedText, Transcription};
use crate::translation::{
    full_text_prompt, indexed_original_words_with_timestamps, indexed_target_words,
    segment_level_prompt, split_words, word_level_prompt,
};

/// The result of translating one utterance into one target language.
#[derive(Debug, Clone, PartialEq)]
pub struct TranslatedUtterance {
    pub full_text: TranslatedText,
    /// One matched segment per transcript segment.
    pub matched_segments: Vec<MatchedTranslatedSegment>,
}

pub fn translate_utterance<C: AiClient>(
    client: &C,
    transcription: &Transcription,
    target: &LanguageConfig,
    original_language: &str,
) -> Result<TranslatedUtterance, crate::llm::LlmError> {
    // 1. Full-text translation
    let full_text: TranslatedText = client.complete_structured(
        &full_text_prompt(original_language, target, &transcription.text),
        "TranslatedText",
    )?;

    // 2 + 3. Per segment: translate, then word-match
    let duration_ms = transcription
        .segments
        .last()
        .map(|s| s.end_ms)
        .unwrap_or(0);
    let mut matched_segments = Vec::with_capacity(transcription.segments.len());
    for (i, segment) in transcription.segments.iter().enumerate() {
        let segment_translation: TranslatedText = client.complete_structured(
            &segment_level_prompt(
                original_language,
                target,
                &transcription.text,
                i,
                transcription.segments.len(),
                &segment.text,
                segment.start_ms as f64 / 1000.0,
                segment.end_ms as f64 / 1000.0,
                duration_ms as f64 / 1000.0,
            ),
            "TranslatedText",
        )?;

        let target_words = split_words(&segment_translation.translated_text);
        let matched: MatchedTranslatedSegment = client.complete_structured(
            &word_level_prompt(
                original_language,
                target,
                &indexed_original_words_with_timestamps(&segment.words),
                &indexed_target_words(&target_words),
            ),
            "MatchedTranslatedSegment",
        )?;
        matched_segments.push(matched);
    }

    Ok(TranslatedUtterance {
        full_text,
        matched_segments,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::LlmError;
    use crate::models::{
        LanguageBackground, TranscriptSegment, WordTimestamp,
    };
    use schemars::JsonSchema;
    use serde::de::DeserializeOwned;

    /// Returns canned responses keyed by the response_name.
    struct FakeClient;

    impl AiClient for FakeClient {
        fn complete_structured<T>(&self, _prompt: &str, response_name: &str) -> Result<T, LlmError>
        where
            T: DeserializeOwned + JsonSchema,
        {
            let v = match response_name {
                "TranslatedText" => serde_json::json!({
                    "translated_text": "Hola mundo",
                    "translated_language_name": "Spanish",
                    "romanization_method": null
                }),
                "MatchedTranslatedSegment" => serde_json::json!({
                    "start": 0.0,
                    "end": 1.0,
                    "original_segment_text": "Hello world",
                    "translated_segment_text": "Hola mundo",
                    "original_words_list": ["Hello", "world"],
                    "translated_words_list": ["Hola", "mundo"],
                    "matched_translated_words": [
                        {"start_time": 0.0, "end_time": 0.4, "original_word_text": "Hello", "original_word_index": 0, "translated_word_text": "Hola", "translated_word_index": 0},
                        {"start_time": 0.5, "end_time": 0.9, "original_word_text": "world", "original_word_index": 1, "translated_word_text": "mundo", "translated_word_index": 1}
                    ]
                }),
                _ => return Err(LlmError::MissingContent),
            };
            serde_json::from_value(v).map_err(LlmError::Json)
        }
    }

    fn sample_transcription() -> Transcription {
        Transcription {
            language: "english".into(),
            text: "Hello world".into(),
            segments: vec![TranscriptSegment {
                start_ms: 0,
                end_ms: 1000,
                text: "Hello world".into(),
                words: vec![
                    WordTimestamp {
                        start_ms: 0,
                        end_ms: 400,
                        text: "Hello".into(),
                        index_in_segment: 0,
                        index_in_transcript: 0,
                    },
                    WordTimestamp {
                        start_ms: 500,
                        end_ms: 900,
                        text: "world".into(),
                        index_in_segment: 1,
                        index_in_transcript: 1,
                    },
                ],
            }],
        }
    }

    fn spanish() -> LanguageConfig {
        LanguageConfig {
            language_name: "Spanish".into(),
            language_code: "es".into(),
            romanization_method: None,
            background: LanguageBackground {
                family_tree: vec!["Indo-European".into(), "Italic".into(), "Romance".into()],
                alphabet: "Latin".into(),
                sample_text: "El veloz murciélago".into(),
                sample_romanized_text: None,
                wikipedia_links: vec![],
            },
        }
    }

    #[test]
    fn translates_an_utterance() {
        let out = translate_utterance(&FakeClient, &sample_transcription(), &spanish(), "English").unwrap();
        assert_eq!(out.full_text.translated_text, "Hola mundo");
        assert_eq!(out.matched_segments.len(), 1);
        assert_eq!(out.matched_segments[0].matched_translated_words.len(), 2);
        assert_eq!(out.matched_segments[0].matched_translated_words[0].translated_word_text, "Hola");
    }

    #[test]
    fn returns_missing_content_error() {
        struct BrokenClient;
        impl AiClient for BrokenClient {
            fn complete_structured<T>(&self, _p: &str, _n: &str) -> Result<T, LlmError>
            where
                T: DeserializeOwned + JsonSchema,
            {
                Err(LlmError::MissingContent)
            }
        }
        let err = translate_utterance(&BrokenClient, &sample_transcription(), &spanish(), "English").unwrap_err();
        assert!(matches!(err, LlmError::MissingContent));
    }
}

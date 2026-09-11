//! Translation types. `TranslatedText` is the LLM's structured response for
//! both full-text and segment-level translation (same schema the original used).

use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

use super::serde::opt_none_string;

/// A translation of a single piece of text (full transcript or one segment).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct TranslatedText {
    /// The translation in the target language's script/characters.
    #[schemars(description = "The translated text in the target language, using the target language's script, characters, and/or alphabet.")]
    pub translated_text: String,
    /// Romanized form, when the target script is non-Latin.
    #[serde(default, deserialize_with = "opt_none_string")]
    #[schemars(description = "The romanized version of the translated text, if applicable.")]
    pub romanized_text: Option<String>,
    /// Name of the target language (echoed by the model).
    #[schemars(description = "The name of the target language.")]
    pub translated_language_name: String,
    /// The romanization method used (if any).
    #[serde(default, deserialize_with = "opt_none_string")]
    #[schemars(description = "The method used to romanize the translated text, if applicable.")]
    pub romanization_method: Option<String>,
}

/// A translated transcript segment (domain type): original segment timing +
/// its translation. Built by the orchestrator, not returned by the LLM.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TranslatedSegment {
    pub start_ms: i64,
    pub end_ms: i64,
    pub original_text: String,
    pub translation: TranslatedText,
}

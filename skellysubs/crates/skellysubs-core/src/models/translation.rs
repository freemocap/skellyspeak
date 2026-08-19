//! Translation types. TranslatedText is the LLM's structured response for both
//! full-text and segment-level translation.

use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

use super::serde::opt_none_string;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct TranslatedText {
    #[schemars(description = "The translated text in the target language, using the target language's script, characters, and/or alphabet.")]
    pub translated_text: String,
    #[serde(default, deserialize_with = "opt_none_string")]
    #[schemars(description = "The romanized version of the translated text, if applicable.")]
    pub romanized_text: Option<String>,
    #[schemars(description = "The name of the target language.")]
    pub translated_language_name: String,
    #[serde(default, deserialize_with = "opt_none_string")]
    #[schemars(description = "The method used to romanize the translated text, if applicable.")]
    pub romanization_method: Option<String>,
}

/// A translated transcript segment: original segment timing + its translation.
/// Built by the orchestrator, not returned by the LLM.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TranslatedSegment {
    pub start_ms: i64,
    pub end_ms: i64,
    pub original_text: String,
    pub translation: TranslatedText,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn empty_and_none_romanized_become_none() {
        let t: TranslatedText = serde_json::from_value(json!({
            "translated_text": "Hola",
            "romanized_text": "",
            "translated_language_name": "Spanish",
            "romanization_method": "NONE"
        }))
        .unwrap();
        assert_eq!(t.romanized_text, None);
        assert_eq!(t.romanization_method, None);
    }

    #[test]
    fn real_romanized_round_trips() {
        let t: TranslatedText = serde_json::from_value(json!({
            "translated_text": "مرحبا",
            "romanized_text": "marhaban",
            "translated_language_name": "Arabic (Levantine)",
            "romanization_method": "ALA_LC"
        }))
        .unwrap();
        assert_eq!(t.romanized_text.as_deref(), Some("marhaban"));
        let s = serde_json::to_string(&t).unwrap();
        let rt: TranslatedText = serde_json::from_str(&s).unwrap();
        assert_eq!(rt, t);
    }
}

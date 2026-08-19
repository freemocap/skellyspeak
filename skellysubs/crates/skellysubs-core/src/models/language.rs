//! Language configuration types, loaded from the canonical 78-language JSON.

use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

use super::serde::opt_none_string;

/// Background/typological information about a language, used to give the
/// translation LLM context about the target language.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct LanguageBackground {
    pub family_tree: Vec<String>,
    pub alphabet: String,
    pub sample_text: String,
    #[serde(default, deserialize_with = "opt_none_string")]
    pub sample_romanized_text: Option<String>,
    #[serde(default)]
    pub wikipedia_links: Vec<String>,
}

/// A single language's translation + romanization configuration.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct LanguageConfig {
    pub language_name: String,
    /// ISO-639-1 code (e.g. "en", "es", "ar").
    pub language_code: String,
    /// Romanization method (PINYIN, ALA_LC, ISO_15919, ...), or None when the
    /// language needs no romanization.
    #[serde(deserialize_with = "opt_none_string")]
    pub romanization_method: Option<String>,
    pub background: LanguageBackground,
}

impl LanguageConfig {
    pub fn romanization_is_none(&self) -> bool {
        self.romanization_method.is_none()
    }

    /// A compact JSON description of this config, injected into translation
    /// prompts.
    pub fn prompt_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| "{}".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn none_romanization_deserializes_to_none() {
        let cfg: LanguageConfig = serde_json::from_value(json!({
            "language_name": "English",
            "language_code": "en",
            "romanization_method": "NONE",
            "background": {
                "family_tree": ["Indo-European", "Germanic"],
                "alphabet": "Latin",
                "sample_text": "The quick brown fox",
                "sample_romanized_text": "NONE",
                "wikipedia_links": []
            }
        }))
        .unwrap();
        assert_eq!(cfg.romanization_method, None);
        assert_eq!(cfg.background.sample_romanized_text, None);
        assert!(cfg.romanization_is_none());
    }

    #[test]
    fn real_romanization_round_trips() {
        let cfg: LanguageConfig = serde_json::from_value(json!({
            "language_name": "Arabic (Levantine)",
            "language_code": "ar",
            "romanization_method": "ALA_LC",
            "background": {
                "family_tree": ["Afro-Asiatic", "Semitic"],
                "alphabet": "Arabic",
                "sample_text": "...",
                "wikipedia_links": ["https://en.wikipedia.org/wiki/Arabic"]
            }
        }))
        .unwrap();
        assert_eq!(cfg.romanization_method.as_deref(), Some("ALA_LC"));
        let s = serde_json::to_string(&cfg).unwrap();
        let rt: LanguageConfig = serde_json::from_str(&s).unwrap();
        assert_eq!(rt, cfg);
    }
}

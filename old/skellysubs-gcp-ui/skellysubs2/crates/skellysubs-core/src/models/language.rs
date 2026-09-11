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
    /// ISO-639-1 code (e.g. `"en"`, `"es"`, `"ar"`).
    pub language_code: String,
    /// Romanization method (e.g. `"PINYIN"`, `"ALA_LC"`, `"ISO_15919"`), or
    /// `None` when the language needs no romanization.
    #[serde(deserialize_with = "opt_none_string")]
    pub romanization_method: Option<String>,
    pub background: LanguageBackground,
}

impl LanguageConfig {
    /// True when this language's script requires no romanization.
    pub fn romanization_is_none(&self) -> bool {
        self.romanization_method.is_none()
    }

    /// A compact JSON description of this config, injected into translation
    /// prompts (mirrors the original `model_dump_json(exclude=annotation)`).
    pub fn prompt_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| "{}".to_string())
    }
}

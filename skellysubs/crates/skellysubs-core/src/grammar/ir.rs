//! The intermediate representation — the contract every language analyzer emits.
//! The card engine, learner model, and UI only ever read this. Adding Mandarin or
//! Levantine later means writing a new Analyzer that fills this same shape.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Token {
    pub text: String,
    pub lemma: String,
    #[schemars(description = "Universal POS tag: VERB, NOUN, PRON, ADJ, DET, ADP, ...")]
    pub pos: String,
    #[serde(default)]
    pub gloss: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Feature {
    pub key: String,
    pub value: String,
    pub token_index: usize,
}

impl Feature {
    /// Canonical id used to match cards and track exposure, e.g. "Tense=Past".
    pub fn id(&self) -> String {
        format!("{}={}", self.key, self.value)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct Construction {
    pub id: String,
    pub token_span: (usize, usize),
}

/// Everything an analyzer produces for one utterance.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FeatureEvent {
    pub language: String,
    pub source_text: String,
    pub tokens: Vec<Token>,
    pub features: Vec<Feature>,
    pub constructions: Vec<Construction>,
}

/// The raw LLM response shape for the analyzer (no language/source_text — those
/// are added by the analyzer from context).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub(crate) struct RawAnalysis {
    #[serde(default)]
    pub tokens: Vec<Token>,
    #[serde(default)]
    pub features: Vec<Feature>,
    #[serde(default)]
    pub constructions: Vec<Construction>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn feature_id_is_key_eq_value() {
        let f = Feature { key: "Tense".into(), value: "Past".into(), token_index: 0 };
        assert_eq!(f.id(), "Tense=Past");
    }

    #[test]
    fn raw_analysis_defaults_to_empty() {
        let raw: RawAnalysis = serde_json::from_str("{}").unwrap();
        assert!(raw.tokens.is_empty());
        assert!(raw.features.is_empty());
        assert!(raw.constructions.is_empty());
    }
}

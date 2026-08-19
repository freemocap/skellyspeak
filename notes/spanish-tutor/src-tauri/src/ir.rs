//! The intermediate representation — the *contract* every language analyzer emits.
//! The card engine, learner model, and UI only ever read this. Adding Mandarin or
//! Levantine later means writing a new Analyzer that fills this same shape; nothing
//! downstream changes.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub text: String,
    pub lemma: String,
    /// Universal POS tag: VERB, NOUN, PRON, ADJ, DET, ADP, ...
    pub pos: String,
    /// Optional literal-ish gloss for the panel (word-level, à la skellysubs).
    #[serde(default)]
    pub gloss: String,
}

/// A single morphological fact attached to a token, e.g. {Tense, Past}.
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// A multi-token pattern the learner is meeting, e.g. "ser_vs_estar".
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Construction {
    pub id: String,
    pub token_span: (usize, usize),
}

/// Everything an analyzer produces for one utterance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureEvent {
    pub language: String,
    pub source_text: String,
    pub tokens: Vec<Token>,
    pub features: Vec<Feature>,
    pub constructions: Vec<Construction>,
}

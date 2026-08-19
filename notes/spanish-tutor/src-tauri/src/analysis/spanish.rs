//! Spanish analyzer.
//!
//! NOTE ON RELIABILITY: this default implementation asks Gemma to emit the
//! morphological analysis as strict JSON. It is the *fast* path to a working
//! app, but it is exactly the freeform-LLM-grammar approach that can be
//! inconsistent. The intended production path is `SpacySidecarAnalyzer` below,
//! which shells out to a bundled Python sidecar running spaCy's `es_core_news`
//! (or Stanza) for deterministic Universal Dependencies tags. Both emit the
//! identical `FeatureEvent`, so swapping them changes nothing downstream.

use super::Analyzer;
use crate::ir::{Construction, Feature, FeatureEvent, Token};
use crate::llm::LlmClient;
use async_trait::async_trait;
use serde::Deserialize;
use std::sync::Arc;

const SYSTEM: &str = r#"You are a Spanish morphological analyzer. Given one Spanish sentence, return ONLY JSON (no prose) with this exact shape:
{
  "tokens": [{"text": str, "lemma": str, "pos": str, "gloss": str}],
  "features": [{"key": str, "value": str, "token_index": int}],
  "constructions": [{"id": str, "token_span": [int, int]}]
}
Rules:
- "pos" uses Universal POS tags (VERB, NOUN, PRON, ADJ, DET, ADP, AUX, ADV, CCONJ, SCONJ, NUM, PROPN, PUNCT, INTJ).
- "features" use Universal Features. Emit these when present: Tense (Past|Pres|Fut|Imp), Mood (Ind|Sub|Imp|Cnd), Person (1|2|3), Number (Sing|Plur), Gender (Masc|Fem), VerbForm (Fin|Inf|Part|Ger).
- "token_index" is the 0-based index into "tokens".
- "gloss" is a 1-2 word English gloss of that token.
- Detect these constructions by id when present: "ser_vs_estar", "preterite_vs_imperfect", "gender_agreement", "reflexive_se", "por_vs_para". token_span is [start,end] token indices, inclusive-exclusive.
- Return {"tokens":[],"features":[],"constructions":[]} if the input is empty."#;

#[derive(Deserialize)]
struct RawToken { text: String, lemma: String, pos: String, #[serde(default)] gloss: String }
#[derive(Deserialize)]
struct RawFeature { key: String, value: String, token_index: usize }
#[derive(Deserialize)]
struct RawConstruction { id: String, token_span: (usize, usize) }
#[derive(Deserialize)]
struct RawAnalysis {
    #[serde(default)] tokens: Vec<RawToken>,
    #[serde(default)] features: Vec<RawFeature>,
    #[serde(default)] constructions: Vec<RawConstruction>,
}

pub struct SpanishLlmAnalyzer {
    client: Arc<dyn LlmClient>,
}

impl SpanishLlmAnalyzer {
    pub fn new(client: Arc<dyn LlmClient>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl Analyzer for SpanishLlmAnalyzer {
    fn language(&self) -> &str { "es" }

    async fn analyze(&self, text: &str) -> anyhow::Result<FeatureEvent> {
        if text.trim().is_empty() {
            return Ok(empty_event(text));
        }
        let raw = self.client.complete_json(SYSTEM, text).await?;
        let parsed: RawAnalysis = serde_json::from_str(&raw)
            .map_err(|e| anyhow::anyhow!("analyzer returned non-conforming JSON: {e}; raw={raw}"))?;

        Ok(FeatureEvent {
            language: "es".into(),
            source_text: text.to_string(),
            tokens: parsed.tokens.into_iter().map(|t| Token {
                text: t.text, lemma: t.lemma, pos: t.pos, gloss: t.gloss,
            }).collect(),
            features: parsed.features.into_iter().map(|f| Feature {
                key: f.key, value: f.value, token_index: f.token_index,
            }).collect(),
            constructions: parsed.constructions.into_iter().map(|c| Construction {
                id: c.id, token_span: c.token_span,
            }).collect(),
        })
    }
}

fn empty_event(text: &str) -> FeatureEvent {
    FeatureEvent {
        language: "es".into(),
        source_text: text.to_string(),
        tokens: vec![],
        features: vec![],
        constructions: vec![],
    }
}

/// The intended production analyzer: a bundled Python sidecar running spaCy/Stanza.
/// Wire this up with Tauri's sidecar mechanism, then flip the default in lib.rs.
#[allow(dead_code)]
pub struct SpacySidecarAnalyzer;

#[async_trait]
#[allow(dead_code)]
impl Analyzer for SpacySidecarAnalyzer {
    fn language(&self) -> &str { "es" }
    async fn analyze(&self, _text: &str) -> anyhow::Result<FeatureEvent> {
        // TODO: spawn/queue the spaCy sidecar (tauri_plugin_shell sidecar),
        // send `_text`, parse its UD output into FeatureEvent.
        anyhow::bail!("SpacySidecarAnalyzer not wired yet — see README 'Upgrading the analyzer'")
    }
}

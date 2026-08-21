//! Spanish analyzer (LLM-JSON implementation, with a deterministic fallback).
//! The production path will be a deterministic spaCy/Stanza sidecar; this LLM
//! path is the fast way to a working app, and both emit the same IR.

use crate::llm::{AiClient, LlmError};

use super::ir::{Construction, Feature, FeatureEvent, RawAnalysis, Token};

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

pub struct SpanishLlmAnalyzer;

impl SpanishLlmAnalyzer {
    pub fn language(&self) -> &str {
        "es"
    }

    pub fn analyze<C: AiClient>(&self, client: &C, text: &str) -> Result<FeatureEvent, LlmError> {
        if text.trim().is_empty() {
            return Ok(FeatureEvent {
                language: "es".into(),
                source_text: text.to_string(),
                tokens: vec![],
                features: vec![],
                constructions: vec![],
            });
        }

        let prompt = format!(
            "{system}\n\nSENTENCE TO ANALYZE:\n{text}",
            system = SYSTEM,
            text = text
        );

        let mut raw: RawAnalysis = client.complete_structured(&prompt, "Analysis")?;

        // Small local models often skip Universal Features; fill the preterite
        // deterministically so the Tense=Past card still fires.
        if raw.features.is_empty() {
            raw.features = fallback_features(&raw.tokens);
        }
        if raw.constructions.is_empty() {
            raw.constructions = fallback_constructions(&raw.tokens);
        }

        Ok(FeatureEvent {
            language: "es".into(),
            source_text: text.to_string(),
            tokens: raw.tokens,
            features: raw.features,
            constructions: raw.constructions,
        })
    }
}

/// Detect the Spanish preterite (simple past) from verb endings. This is the
/// high-confidence, common case (hablé/habló/comí/comió/...); a full
/// deterministic morphology lives in the future spaCy/Stanza sidecar.
fn fallback_features(tokens: &[Token]) -> Vec<Feature> {
    const PRETERITE: [&str; 12] = [
        "é", "aste", "ó", "amos", "asteis", "aron",
        "í", "iste", "ió", "imos", "isteis", "ieron",
    ];
    let mut features = Vec::new();
    for (i, tok) in tokens.iter().enumerate() {
        if tok.pos != "VERB" {
            continue;
        }
        let t = tok.text.to_lowercase();
        if PRETERITE.iter().any(|s| t.ends_with(s)) {
            features.push(Feature {
                key: "Tense".into(),
                value: "Past".into(),
                token_index: i,
            });
        }
    }
    features
}

/// Detect the ser/estar contrast from the most common surface forms, so the
/// "ser vs estar" card fires even when the LLM omits constructions.
fn fallback_constructions(tokens: &[Token]) -> Vec<Construction> {
    const SER: [&str; 10] = [
        "ser", "es", "soy", "eres", "son", "era", "eran", "fue", "fueron", "sea",
    ];
    const ESTAR: [&str; 11] = [
        "estar", "está", "estoy", "estás", "están", "estamos", "estaba", "estaban",
        "estuve", "estando", "estuviste",
    ];
    let mut constructions = Vec::new();
    for (i, tok) in tokens.iter().enumerate() {
        let t = tok.text.to_lowercase();
        let t = t.as_str();
        if SER.contains(&t) || ESTAR.contains(&t) {
            constructions.push(Construction {
                id: "ser_vs_estar".into(),
                token_span: (i, i + 1),
            });
        }
    }
    constructions
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::LlmError;
    use schemars::JsonSchema;
    use serde::de::DeserializeOwned;

    #[test]
    fn empty_text_yields_empty_event() {
        let e = SpanishLlmAnalyzer.analyze(&FakeClient, "   ").unwrap();
        assert!(e.tokens.is_empty());
    }

    #[test]
    fn parses_analysis_from_client() {
        let e = SpanishLlmAnalyzer.analyze(&FakeClient, "hablé").unwrap();
        assert_eq!(e.tokens.len(), 1);
        assert_eq!(e.tokens[0].lemma, "hablar");
        assert_eq!(e.features[0].id(), "Tense=Past");
    }

    #[test]
    fn falls_back_to_heuristic_when_llm_omits_features() {
        struct EmptyFeatureClient;
        impl AiClient for EmptyFeatureClient {
            fn complete_structured<T>(&self, _p: &str, _n: &str) -> Result<T, LlmError>
            where
                T: DeserializeOwned + JsonSchema,
            {
                let v = serde_json::json!({
                    "tokens": [{"text": "hablé", "lemma": "hablar", "pos": "VERB", "gloss": "I spoke"}],
                    "features": [],
                    "constructions": []
                });
                serde_json::from_value(v).map_err(LlmError::Json)
            }
        }
        let e = SpanishLlmAnalyzer.analyze(&EmptyFeatureClient, "hablé").unwrap();
        assert!(e.features.iter().any(|f| f.id() == "Tense=Past"));
    }

    #[test]
    fn heuristic_detects_ser_estar() {
        let tokens = vec![
            Token { text: "Estoy".into(), lemma: "estar".into(), pos: "AUX".into(), gloss: "I am".into() },
            Token { text: "bien".into(), lemma: "bien".into(), pos: "ADV".into(), gloss: "well".into() },
        ];
        let cons = fallback_constructions(&tokens);
        assert_eq!(cons.len(), 1);
        assert_eq!(cons[0].id, "ser_vs_estar");
        assert_eq!(cons[0].token_span, (0, 1));
    }

    #[test]
    fn heuristic_detects_es_as_ser() {
        let tokens = vec![Token { text: "es".into(), lemma: "ser".into(), pos: "VERB".into(), gloss: "is".into() }];
        assert!(fallback_constructions(&tokens).iter().any(|c| c.id == "ser_vs_estar"));
    }

    #[test]
    fn heuristic_ignores_present_tense() {
        let tokens = vec![Token {
            text: "hablo".into(),
            lemma: "hablar".into(),
            pos: "VERB".into(),
            gloss: "I speak".into(),
        }];
        assert!(fallback_features(&tokens).is_empty());
    }

    struct FakeClient;
    impl AiClient for FakeClient {
        fn complete_structured<T>(&self, _p: &str, name: &str) -> Result<T, LlmError>
        where
            T: DeserializeOwned + JsonSchema,
        {
            assert_eq!(name, "Analysis");
            let v = serde_json::json!({
                "tokens": [{"text": "hablé", "lemma": "hablar", "pos": "VERB", "gloss": "I spoke"}],
                "features": [{"key": "Tense", "value": "Past", "token_index": 0}],
                "constructions": []
            });
            serde_json::from_value(v).map_err(LlmError::Json)
        }
    }
}

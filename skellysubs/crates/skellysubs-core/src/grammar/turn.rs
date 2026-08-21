//! The turn flow: tutor reply -> analysis -> cards -> new words.

use serde::Serialize;

use crate::llm::{AiClient, LlmError};
use crate::models::{LanguageConfig, TutorReply};

use super::analyzer::SpanishLlmAnalyzer;
use super::cards::{Card, CardLibrary};
use super::ir::FeatureEvent;
use super::learner::LearnerModel;

#[derive(Debug, Clone, Serialize)]
pub struct TutorTurn {
    pub reply: TutorReply,
    pub analysis: FeatureEvent,
    pub cards: Vec<Card>,
    pub new_words: Vec<String>,
    pub suggestions: Vec<crate::tutor::Suggestion>,
}

const CONTENT_POS: [&str; 4] = ["VERB", "NOUN", "ADJ", "ADV"];

pub fn run_turn<C: AiClient>(
    client: &C,
    shared: &LanguageConfig,
    target: &LanguageConfig,
    library: &CardLibrary,
    learner: &mut LearnerModel,
    user_text: &str,
) -> Result<TutorTurn, LlmError> {
    // 1. Conversation (mixed-language tutor reply), sheltered to known vocab.
    let vocab = learner.sorted_known_vocab();
    let reply = crate::tutor::tutor_reply(client, shared, target, &vocab, &[], user_text)?;
    run_turn_with_reply(client, library, learner, reply)
}

/// The post-reply half of a turn: analyze the reply, surface new words, trigger
/// cards, and update the learner. Split out so the streaming path can supply a
/// reply it already has (without a second tutor call).
pub fn run_turn_with_reply<C: AiClient>(
    client: &C,
    library: &CardLibrary,
    learner: &mut LearnerModel,
    reply: TutorReply,
) -> Result<TutorTurn, LlmError> {
    // 2. Analyze the reply (the comprehensible input the learner reads).
    let analysis = SpanishLlmAnalyzer.analyze(client, &reply.reply)?;

    // 3. Surface content words above the known set as "new" (i+1).
    let mut new_words = Vec::new();
    for tok in &analysis.tokens {
        if CONTENT_POS.contains(&tok.pos.as_str()) && !learner.knows(&tok.lemma) {
            new_words.push(tok.lemma.clone());
            learner.expose_vocab(&tok.lemma);
        }
    }
    new_words.sort();
    new_words.dedup();

    // 4. Trigger mechanics cards from the IR + learner novelty.
    let cards = library.trigger(&analysis, learner);

    // 5. Update learner state.
    for f in &analysis.features {
        learner.mark_seen(&f.id());
    }
    for c in &analysis.constructions {
        learner.mark_seen(&c.id);
    }
    for card in &cards {
        learner.note_card_shown(&card.id);
    }

    Ok(TutorTurn {
        reply,
        analysis,
        cards,
        new_words,
        suggestions: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages;
    use schemars::JsonSchema;
    use serde::de::DeserializeOwned;

    struct Fake;
    impl AiClient for Fake {
        fn complete_structured<T>(&self, _p: &str, name: &str) -> Result<T, LlmError>
        where
            T: DeserializeOwned + JsonSchema,
        {
            let v = if name == "TutorReply" {
                serde_json::json!({ "reply": "Hablé con ella ayer." })
            } else {
                serde_json::json!({
                    "tokens": [{"text": "Hablé", "lemma": "hablar", "pos": "VERB", "gloss": "I spoke"}],
                    "features": [{"key": "Tense", "value": "Past", "token_index": 0}],
                    "constructions": []
                })
            };
            serde_json::from_value(v).map_err(LlmError::Json)
        }
    }

    #[test]
    fn run_turn_returns_reply_analysis_cards_and_new_words() {
        let shared = languages::get("english").unwrap();
        let target = languages::get("spanish").unwrap();
        let lib = crate::grammar::cards::CardLibrary::from_json(
            crate::grammar::cards::SPANISH_CARDS_JSON,
        )
        .unwrap();
        let mut learner = LearnerModel::default();

        let turn = run_turn(&Fake, &shared, &target, &lib, &mut learner, "hi").unwrap();

        assert_eq!(turn.reply.reply, "Hablé con ella ayer.");
        assert_eq!(turn.analysis.tokens[0].lemma, "hablar");
        assert!(turn.cards.iter().any(|c| c.id == "es-preterite"));
        assert!(turn.new_words.contains(&"hablar".to_string()));
    }

    #[test]
    fn run_turn_with_reply_skips_tutor_call() {
        let lib = crate::grammar::cards::CardLibrary::from_json(
            crate::grammar::cards::SPANISH_CARDS_JSON,
        )
        .unwrap();
        let mut learner = LearnerModel::default();
        let reply = TutorReply {
            reply: "Hablé con ella ayer.".into(),
            target_phrase: None,
            romanization: None,
            explanation: None,
        };
        let turn = run_turn_with_reply(&Fake, &lib, &mut learner, reply).unwrap();
        assert_eq!(turn.reply.reply, "Hablé con ella ayer.");
        assert_eq!(turn.analysis.tokens[0].lemma, "hablar");
        assert!(turn.cards.iter().any(|c| c.id == "es-preterite"));
    }
}

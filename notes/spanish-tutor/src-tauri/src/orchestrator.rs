//! The turn loop: assemble a sheltered prompt, get a Spanish reply, analyze it,
//! trigger cards, and update the learner. This is the language-agnostic spine —
//! only the injected Analyzer knows it's Spanish.

use crate::analysis::Analyzer;
use crate::cards::{Card, CardLibrary};
use crate::ir::FeatureEvent;
use crate::learner::LearnerModel;
use crate::llm::{ChatMessage, LlmClient};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct TurnResult {
    pub reply: String,
    pub analysis: FeatureEvent,
    pub cards: Vec<Card>,
    /// Content-word lemmas in the reply that were above the learner's known set —
    /// i.e. new vocabulary the sheltering pass introduced (i+1).
    pub new_words: Vec<String>,
}

fn system_prompt(level: &str) -> String {
    format!(
        "You are a warm, patient Spanish conversation partner for a self-learner at CEFR level {level}.\n\
         Rules:\n\
         - Reply ONLY in Spanish (no English), 1-2 short sentences.\n\
         - Use high-frequency vocabulary and simple structures appropriate to {level}.\n\
         - Introduce at most ONE new word or structure per turn (i+1); keep everything else familiar.\n\
         - Stay concrete and conversational; ask a simple follow-up question to keep the exchange going.\n\
         - Never explain grammar yourself — the app handles that."
    )
}

const CONTENT_POS: [&str; 4] = ["VERB", "NOUN", "ADJ", "ADV"];

pub async fn run_turn(
    client: &dyn LlmClient,
    analyzer: &dyn Analyzer,
    library: &CardLibrary,
    learner: &mut LearnerModel,
    history: &[ChatMessage],
    user_text: &str,
) -> anyhow::Result<TurnResult> {
    // 1. Assemble the sheltered conversation prompt.
    let mut messages = vec![ChatMessage::system(system_prompt(&learner.level))];
    messages.extend_from_slice(history);
    messages.push(ChatMessage::user(user_text.to_string()));

    // 2. Conversation LLM — dialogue only.
    let reply = client.chat(&messages).await?;

    // 3. Analyze the reply (the comprehensible input the learner will read).
    let analysis = analyzer.analyze(&reply).await?;

    // 4. Sheltering check: surface content words above the known set as "new".
    //    (A stricter version would regenerate when too many are unknown; left as
    //    a TODO so the scaffold stays responsive.)
    let mut new_words = Vec::new();
    for tok in &analysis.tokens {
        if CONTENT_POS.contains(&tok.pos.as_str()) && !learner.knows(&tok.lemma) {
            new_words.push(tok.lemma.clone());
            learner.expose_vocab(&tok.lemma);
        }
    }
    new_words.sort();
    new_words.dedup();

    // 5. Trigger mechanics cards from the IR + learner novelty.
    let cards = library.trigger(&analysis, learner);

    // 6. Update learner state (features seen, cards shown) and persist.
    for f in &analysis.features {
        learner.mark_seen(&f.id());
    }
    for c in &analysis.constructions {
        learner.mark_seen(&c.id);
    }
    for card in &cards {
        learner.note_card_shown(&card.id);
    }
    learner.save();

    Ok(TurnResult { reply, analysis, cards, new_words })
}

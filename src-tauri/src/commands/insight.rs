//! The hold-to-inspect word card.

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{State};
use crate::ontology;
use crate::languages::{language_display, native_display};
use crate::prompts;
use crate::trace::{RunContext};
use crate::AppState;

// ─── Word insight (hold-to-inspect modal) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct WordInsight {
    /// Dictionary form of the word.
    #[schemars(length(min = 1))]
    pub lemma: String,
    /// Part of speech as used in the sentence.
    #[schemars(length(min = 1))]
    pub pos: String,
    /// Conjugation/declension details: tense, mood, person, number, gender.
    #[schemars(length(min = 1))]
    pub form: String,
    /// Grammatical role in the sentence.
    #[schemars(length(min = 1))]
    pub role: String,
    /// One practical usage note, in the learner's native language.
    #[schemars(length(min = 1))]
    pub usage: String,
}

/// Deep word analysis: lemma, morphology, grammatical role, usage note.
#[tauri::command]
pub async fn word_insight(
    state: State<'_, AppState>,
    word: String,
    sentence: String,
) -> Result<WordInsight, String> {
    let word = word.trim().to_string();
    let sentence = sentence.trim().to_string();
    if word.is_empty() {
        return Err("no word given".into());
    }
    let stored = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let tln = language_display(&stored.target_language);
    let native = native_display(&stored.native_language);
    let messages = vec![
        json!({"role": "system", "content": prompts::analysis::word_insight_prompt(&tln, &native)}),
        json!({"role": "user", "content": prompts::analysis::word_insight_turn(&word, &sentence)}),
    ];
    let provider = stored.chat_provider(&stored.openrouter_model)?;
    provider
        .structured_validated::<WordInsight, _>(
            RunContext::new(ontology::op::WORD_INSIGHT, None),
            &messages,
            0.2,
            "WordInsight",
            false,
            None,
            |w: &WordInsight| {
                if w.lemma.trim().is_empty() || w.usage.trim().is_empty() {
                    Some("lemma and usage must be filled".into())
                } else {
                    None
                }
            },
        )
        .await
}

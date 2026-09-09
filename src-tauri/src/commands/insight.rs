//! The hold-to-inspect word card.

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{State};
use crate::ontology;
use crate::languages::{inflects, language_display, native_display};
use crate::prompts;
use crate::trace::{RunContext};
use crate::AppState;

// ─── Word insight (hold-to-inspect modal) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct WordInsight {
    /// Short translation of this word in context, in the native language.
    #[schemars(length(min = 1))]
    pub gloss: String,
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
        json!({"role": "system", "content": prompts::analysis::word_insight_prompt(&tln, &native, inflects(&stored.target_language))}),
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
                if w.gloss.trim().is_empty() || w.lemma.trim().is_empty() || w.usage.trim().is_empty() {
                    Some("gloss, lemma and usage must be filled".into())
                } else {
                    None
                }
            },
        )
        .await
}

/// Prepare the same glossary annotations used by chat before a reading surface is tapped.
#[tauri::command]
pub async fn annotate_text(
    state: State<'_, AppState>,
    text: String,
    sentence: String,
) -> Result<super::guided::TokensOut, String> {
    if text.trim().is_empty() {
        return Err("no text given".into());
    }
    let stored = state.settings.lock().unwrap_or_else(|p| p.into_inner()).clone();
    let word_delimited = crate::languages::word_delimited(&stored.target_language);
    let messages = vec![
        json!({"role": "system", "content": prompts::analysis::annotations_prompt(
            &language_display(&stored.target_language), &native_display(&stored.native_language),
            crate::languages::romanization(&stored.target_language))}),
        json!({"role": "user", "content": prompts::analysis::annotate_text_turn(&text, &sentence, word_delimited)}),
    ];
    stored.chat_provider(&stored.openrouter_model)?
        .structured_validated::<super::guided::TokensOut, _>(
            RunContext::new(ontology::op::ANNOTATE_TEXT, None), &messages, 0.1, "TokensOut", false, None,
            |out| validate_annotations(&text, out, word_delimited),
        ).await
}

fn validate_annotations(text: &str, out: &super::guided::TokensOut, word_delimited: bool) -> Option<String> {
    let mut remaining = text;
    let expected: Vec<&str> = text.split_whitespace().collect();
    for (index, token) in out.tokens.iter().enumerate() {
        if word_delimited && expected.get(index).copied() != Some(token.text.as_str()) {
            return Some(format!("Token {} text {:?} must exactly equal source entry {:?}; preserve quotes, punctuation and order", index + 1, token.text, expected.get(index)));
        }
        if token.text.is_empty() || (!word_delimited && token.text.chars().count() > 48) {
            return Some(format!("Token {} {:?} must be nonempty and at most 48 characters", index + 1, token.text));
        }
        remaining = remaining.trim_start();
        let Some(rest) = remaining.strip_prefix(&token.text) else {
            return Some(format!("Token {} {:?} must match the next source characters {:?}", index + 1, token.text, remaining.chars().take(48).collect::<String>()));
        };
        if token.text.chars().any(char::is_alphanumeric)
            && (token.gloss.as_ref().is_none_or(|s| s.trim().is_empty())
                || token.pronunciation.as_ref().is_none_or(|s| s.trim().is_empty())) {
            let missing: Vec<&str> = [("gloss", &token.gloss), ("pronunciation", &token.pronunciation)]
                .into_iter().filter_map(|(field, value)| value.as_ref().is_none_or(|s| s.trim().is_empty()).then_some(field)).collect();
            return Some(format!("Token {} {:?} contains letters or numbers and needs nonempty {}. Quotes and parentheses do not make it punctuation", index + 1, token.text, missing.join(" and ")));
        }
        remaining = rest;
    }
    (!remaining.trim().is_empty() || out.tokens.is_empty())
        .then(|| "Tokens must cover the complete source text".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn annotations(words: &[&str]) -> super::super::guided::TokensOut {
        super::super::guided::TokensOut {
            tokens: words.iter().map(|word| super::super::guided::GuidedToken {
                text: (*word).into(), gloss: Some("meaning".into()),
                pronunciation: Some("sound".into()), romanization: None, pos: None, notable: false,
            }).collect(),
        }
    }

    #[test]
    fn annotations_preserve_source_and_require_word_aids() {
        assert!(validate_annotations("Hola, mundo.", &annotations(&["Hola,", "mundo."]), true).is_none());
        assert!(validate_annotations("你好。", &annotations(&["你", "好。"]), false).is_none());
        assert!(validate_annotations("Hola, mundo.", &annotations(&["mundo.", "Hola,"]), true).is_some());
        assert!(validate_annotations("Hola, mundo.", &annotations(&["Hola,"]), true).is_some());
        let mut missing = annotations(&["Hola"]);
        missing.tokens[0].pronunciation = None;
        assert!(validate_annotations("Hola", &missing, true).is_some());
        missing.tokens[0].pronunciation = Some("oh-la".into());
        missing.tokens[0].gloss = None;
        assert!(validate_annotations("Hola", &missing, true).is_some());
    }

    #[test]
    fn mixed_language_labels_preserve_exact_source_entries() {
        for text in ["Using 'querer' (to want) · turn 3", "Acabar de + Infinitive · turn 1",
            "Verbs like 'gustar' · turn 3", "Present Perfect (Pretérito Perfecto Compuesto) · turn 1",
            "  ¿Cómo?\t‘Hola’\nمرحبا  你好。", "anticonstitutionnellementanticonstitutionnellementlong"] {
            let words: Vec<&str> = text.split_whitespace().collect();
            assert!(validate_annotations(text, &annotations(&words), true).is_none(), "{text}");
        }
        let error = validate_annotations("'querer'", &annotations(&["'", "querer", "'"]), true).unwrap();
        assert!(error.contains("Token 1") && error.contains("source entry"));
        assert!(validate_annotations("to want", &annotations(&["to want"]), true).is_some());
        assert!(validate_annotations("Hola", &annotations(&["Hola", "extra"]), true).is_some());
        assert!(validate_annotations("Hola", &annotations(&[]), true).is_some());
    }

    #[test]
    fn quoted_words_require_aids_even_when_model_calls_them_punctuation() {
        for word in ["'querer'", "(to", "want)", "3", "مرحبا", "你好"] {
            let mut out = annotations(&[word]);
            out.tokens[0].pos = Some("PUNCT".into());
            out.tokens[0].gloss = None;
            out.tokens[0].pronunciation = Some("  ".into());
            let error = validate_annotations(word, &out, true).unwrap();
            assert!(error.contains(word) && error.contains("gloss and pronunciation"), "{error}");
        }
        let mut punctuation = annotations(&["·"]);
        punctuation.tokens[0].gloss = None;
        punctuation.tokens[0].pronunciation = None;
        assert!(validate_annotations("·", &punctuation, true).is_none());
        let error = validate_annotations("你好。", &annotations(&["好。"]), false).unwrap();
        assert!(error.contains("next source characters"));
    }
}

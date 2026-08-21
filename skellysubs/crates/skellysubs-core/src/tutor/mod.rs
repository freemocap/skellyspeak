//! Tutor layer — the mixed-language conversation partner.

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::llm::{AiClient, LlmError};
use crate::models::{LanguageConfig, TutorReply};

/// One prior turn in the conversation (role + text).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HistoryTurn {
    pub role: String,
    pub text: String,
}

/// A suggested student reply: Spanish phrase, English gloss, grammar hint.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub es: String,
    pub en: String,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Suggestions {
    pub suggestions: Vec<Suggestion>,
}

/// The tutor persona prompt (template).
pub const TUTOR_SYSTEM_PROMPT: &str = r#"You are a warm, encouraging {target} tutor having a real conversation with a {shared} speaker.

EVERY TURN, DO THIS:
1. Reply to what they just said and KEEP THE CONVERSATION GOING — add one short follow-up question or comment.
2. If they made a grammar mistake, gently correct it: give the correct {target}, then explain WHY in {shared} in one short sentence.
3. If a useful grammar point comes up (ser vs estar, past tense, subjunctive, reflexive verbs, gender, number...), add ONE brief {shared} note about it in parentheses.
4. Otherwise stay in simple {target}; use {shared} only to explain.

CONVERSATION SO FAR:
{history}

KNOWN VOCABULARY (shelter your {target} to these words, plus at most ONE new word per turn):
{known_vocab}

TARGET LANGUAGE INFO:
{target_info}

The user just said/wrote (may mix {shared} and {target}):
{user_text}"#;

fn render(template: &str, vars: &[(&str, &str)]) -> String {
    let mut out = template.to_string();
    for (key, value) in vars {
        out = out.replace(&format!("{{{key}}}"), value);
    }
    out
}

fn render_history(history: &[HistoryTurn]) -> String {
    if history.is_empty() {
        return "(none — this is the first message)".to_string();
    }
    history
        .iter()
        .map(|t| format!("{}: {}", t.role, t.text))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Build the tutor system prompt for one turn, sheltering to known vocab and
/// including the conversation so far.
pub fn tutor_prompt(
    shared: &LanguageConfig,
    target: &LanguageConfig,
    known_vocab: &[String],
    history: &[HistoryTurn],
    user_text: &str,
) -> String {
    let target_info = target.prompt_json();
    let vocab = known_vocab.join(", ");
    let history_str = render_history(history);
    render(
        TUTOR_SYSTEM_PROMPT,
        &[
            ("shared", shared.language_name.as_str()),
            ("target", target.language_name.as_str()),
            ("known_vocab", vocab.as_str()),
            ("target_info", target_info.as_str()),
            ("history", history_str.as_str()),
            ("user_text", user_text),
        ],
    )
}

/// Ask the tutor for a reply to the user's latest input.
pub fn tutor_reply<C: AiClient>(
    client: &C,
    shared: &LanguageConfig,
    target: &LanguageConfig,
    known_vocab: &[String],
    history: &[HistoryTurn],
    user_text: &str,
) -> Result<TutorReply, LlmError> {
    client.complete_structured(
        &tutor_prompt(shared, target, known_vocab, history, user_text),
        "TutorReply",
    )
}

/// Suggest three short student replies (with translations + grammar hints).
pub fn suggest_replies<C: AiClient>(
    client: &C,
    tutor_reply_text: &str,
) -> Result<Vec<Suggestion>, LlmError> {
    let prompt = format!(
        "The tutor just replied (Spanish/English mix):\n{tutor_reply_text}\n\nSuggest THREE short, natural things the student could say back IN SPANISH to continue the conversation. For each: es = the Spanish phrase, en = its English translation, note = a one-line grammar hint."
    );
    let s: Suggestions = client.complete_structured(&prompt, "Suggestions")?;
    Ok(s.suggestions)
}

/// Build the prompt for streaming the tutor reply as plain text (no JSON).
pub fn tutor_stream_prompt(
    shared: &LanguageConfig,
    target: &LanguageConfig,
    known_vocab: &[String],
    history: &[HistoryTurn],
    user_text: &str,
) -> String {
    let base = tutor_prompt(shared, target, known_vocab, history, user_text);
    format!(
        "{base}\n\nReply with ONLY your tutor response as plain text — no JSON, no labels, no gloss table."
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages;
    use schemars::JsonSchema;
    use serde::de::DeserializeOwned;

    #[test]
    fn tutor_prompt_fills_all_placeholders() {
        let shared = languages::get("english").unwrap();
        let target = languages::get("arabic_levantine").unwrap();
        let vocab = vec!["hola".to_string(), "gracias".to_string()];
        let p = tutor_prompt(&shared, &target, &vocab, &[], "How do I say hello?");
        assert!(!p.contains("{shared}"));
        assert!(!p.contains("{target}"));
        assert!(!p.contains("{target_info}"));
        assert!(!p.contains("{user_text}"));
        assert!(!p.contains("{known_vocab}"));
        assert!(!p.contains("{history}"));
        assert!(p.contains("English"));
        assert!(p.contains("Arabic (Levantine)"));
        assert!(p.contains("How do I say hello?"));
        assert!(p.contains("hola, gracias"));
        assert!(p.contains("ALA_LC")); // romanization method in the target info
    }

    #[test]
    fn tutor_prompt_includes_history() {
        let shared = languages::get("english").unwrap();
        let target = languages::get("spanish").unwrap();
        let history = vec![
            HistoryTurn { role: "user".into(), text: "Hola".into() },
            HistoryTurn { role: "assistant".into(), text: "¡Hola! ¿Cómo estás?".into() },
        ];
        let p = tutor_prompt(&shared, &target, &[], &history, "Bien.");
        assert!(p.contains("Hola"));
        assert!(p.contains("¡Hola! ¿Cómo estás?"));
        assert!(p.contains("Bien."));
    }

    #[test]
    fn tutor_stream_prompt_appends_plain_text_instruction() {
        let shared = languages::get("english").unwrap();
        let target = languages::get("spanish").unwrap();
        let p = tutor_stream_prompt(&shared, &target, &[], &[], "hi");
        assert!(p.contains("plain text"));
        assert!(p.contains("hi"));
    }

    #[test]
    fn suggest_replies_uses_client() {
        struct Fake;
        impl AiClient for Fake {
            fn complete_structured<T>(&self, _p: &str, name: &str) -> Result<T, LlmError>
            where
                T: DeserializeOwned + JsonSchema,
            {
                assert_eq!(name, "Suggestions");
                let v = serde_json::json!({
                    "suggestions": [{"es": "Estoy bien", "en": "I am well", "note": "estoy = estar (state)"}]
                });
                serde_json::from_value(v).map_err(LlmError::Json)
            }
        }
        let s = suggest_replies(&Fake, "¿Cómo estás?").unwrap();
        assert_eq!(s.len(), 1);
        assert_eq!(s[0].es, "Estoy bien");
    }

    #[test]
    fn tutor_reply_uses_the_client() {
        struct Fake;
        impl AiClient for Fake {
            fn complete_structured<T>(&self, _p: &str, name: &str) -> Result<T, LlmError>
            where
                T: DeserializeOwned + JsonSchema,
            {
                assert_eq!(name, "TutorReply");
                let v = serde_json::json!({
                    "reply": "Hola! Hello!",
                    "target_phrase": "Hola",
                    "romanization": null,
                    "explanation": "It means hello."
                });
                serde_json::from_value(v).map_err(LlmError::Json)
            }
        }
        let shared = languages::get("english").unwrap();
        let target = languages::get("spanish").unwrap();
        let r = tutor_reply(&Fake, &shared, &target, &[], &[], "hi").unwrap();
        assert_eq!(r.reply, "Hola! Hello!");
        assert_eq!(r.target_phrase.as_deref(), Some("Hola"));
        assert!(r.romanization.is_none());
        assert_eq!(r.explanation.as_deref(), Some("It means hello."));
    }
}

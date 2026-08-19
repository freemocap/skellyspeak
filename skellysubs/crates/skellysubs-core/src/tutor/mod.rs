//! Tutor layer — the mixed-language conversation partner.

use crate::llm::{AiClient, LlmError};
use crate::models::{LanguageConfig, TutorReply};

/// The tutor persona prompt (template).
pub const TUTOR_SYSTEM_PROMPT: &str = r#"You are a friendly, encouraging language tutor helping a {shared} speaker practice {target}.

IMPORTANT RULES:
- Reply in a natural MIX of {target} and {shared}, the way a bilingual person would.
- Use {target} for actual phrases and conversation; use {shared} for explanations, grammar, and corrections.
- Be concise and warm — a conversation partner, not a textbook.
- If the user asks "how do I say ...", give the {target} phrase, its romanization (if non-Latin script), and a short {shared} explanation.

TARGET LANGUAGE INFO:
{target_info}

The user said/wrote (may mix {shared} and {target}):
{user_text}"#;

fn render(template: &str, vars: &[(&str, &str)]) -> String {
    let mut out = template.to_string();
    for (key, value) in vars {
        out = out.replace(&format!("{{{key}}}"), value);
    }
    out
}

/// Build the tutor system prompt for one turn.
pub fn tutor_prompt(shared: &LanguageConfig, target: &LanguageConfig, user_text: &str) -> String {
    let target_info = target.prompt_json();
    render(
        TUTOR_SYSTEM_PROMPT,
        &[
            ("shared", shared.language_name.as_str()),
            ("target", target.language_name.as_str()),
            ("target_info", target_info.as_str()),
            ("user_text", user_text),
        ],
    )
}

/// Ask the tutor for a reply to the user's latest input.
pub fn tutor_reply<C: AiClient>(
    client: &C,
    shared: &LanguageConfig,
    target: &LanguageConfig,
    user_text: &str,
) -> Result<TutorReply, LlmError> {
    client.complete_structured(&tutor_prompt(shared, target, user_text), "TutorReply")
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
        let p = tutor_prompt(&shared, &target, "How do I say hello?");
        assert!(!p.contains("{shared}"));
        assert!(!p.contains("{target}"));
        assert!(!p.contains("{target_info}"));
        assert!(!p.contains("{user_text}"));
        assert!(p.contains("English"));
        assert!(p.contains("Arabic (Levantine)"));
        assert!(p.contains("How do I say hello?"));
        assert!(p.contains("ALA_LC")); // romanization method in the target info
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
        let r = tutor_reply(&Fake, &shared, &target, "hi").unwrap();
        assert_eq!(r.reply, "Hola! Hello!");
        assert_eq!(r.target_phrase.as_deref(), Some("Hola"));
        assert!(r.romanization.is_none());
        assert_eq!(r.explanation.as_deref(), Some("It means hello."));
    }
}
